import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecommendationPopularityEvidence } from "@/types/recommendation";
import {
  NICE_MODEL_RANKING_URL,
  NICE_POPULARITY_COUNT,
  NICE_POPULARITY_FUEL_TYPES,
  getNiceModelRankingUrl,
  parseNiceModelRankingHtml,
  resolveNiceModelRankingEntries,
  type NicePopularityFuelType,
  type ParsedNiceModelRanking,
  type ResolvedNiceModelRankingEntry,
} from "./nice-popularity";
import {
  STORED_FUEL_POPULARITY_VERSION,
  createFuelPopularityEvidenceLookup,
  parseStoredFuelPopularitySnapshot,
  type StoredFuelPopularityBatch,
} from "./fuel-popularity";
import {
  createPopularityEvidenceLookup,
  getPopularityEvidence,
  type PopularityEvidenceLookup,
  type PopularitySnapshot,
} from "./popularity-snapshot";

const MAX_SOURCE_HTML_BYTES = 1_000_000;
const MINIMUM_TOTAL_MAPPED_ENTRIES = 30;
const MINIMUM_MAPPED_ENTRIES_PER_FUEL = 3;

interface StoredLegacyPopularityEntry {
  readonly rank: number;
  readonly registrationCount: number;
  readonly vehicleSlug: string | null;
}

interface ResolvedFuelPopularityEntry extends ResolvedNiceModelRankingEntry {
  readonly fuelType: NicePopularityFuelType;
}

function isStoredLegacyPopularityEntry(value: unknown): value is StoredLegacyPopularityEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return Number.isInteger(entry.rank)
    && typeof entry.registrationCount === "number"
    && Number.isInteger(entry.registrationCount)
    && entry.registrationCount > 0
    && (typeof entry.vehicleSlug === "string" || entry.vehicleSlug === null);
}

/** 배포 전 생성된 단일 전체 30위 스냅샷을 안전한 전환 fallback으로만 읽는다. */
function parseLegacyStoredSnapshot(
  period: string,
  value: unknown
): PopularitySnapshot | null {
  if (!Array.isArray(value) || value.length !== NICE_POPULARITY_COUNT) return null;
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)) return null;
  if (!value.every(isStoredLegacyPopularityEntry)) return null;

  const mappedEntries = value
    .filter((entry) => entry.vehicleSlug !== null)
    .map((entry) => ({
      rank: entry.rank,
      slug: entry.vehicleSlug!,
      registrationCount: entry.registrationCount,
    }));
  const ranks = value.map((entry) => entry.rank).sort((left, right) => left - right);
  if (ranks.some((rank, index) => rank !== index + 1)) return null;
  if (new Set(mappedEntries.map((entry) => entry.slug)).size !== mappedEntries.length) return null;

  return { period, entries: mappedEntries };
}

/**
 * 최신 성공 월의 연료별 순위를 선택 답변에 맞춰 합친다. 새 형식이 아직 한 번도
 * 수집되지 않은 전환 구간에는 기존 전체 30위 스냅샷 또는 정적 기본값을 사용한다.
 */
export async function loadCurrentPopularityEvidenceLookup(
  fuelPreference?: string
): Promise<PopularityEvidenceLookup> {
  try {
    const snapshot = await prisma.recommendationPopularitySnapshot.findFirst({
      orderBy: [{ period: "desc" }],
      select: { period: true, entries: true },
    });
    if (!snapshot) return getPopularityEvidence;

    const fuelSnapshot = parseStoredFuelPopularitySnapshot(snapshot.period, snapshot.entries);
    if (fuelSnapshot) {
      return createFuelPopularityEvidenceLookup(fuelSnapshot, fuelPreference);
    }

    const legacySnapshot = parseLegacyStoredSnapshot(snapshot.period, snapshot.entries);
    if (legacySnapshot) return createPopularityEvidenceLookup(legacySnapshot);

    console.error("[recommend/popularity] 최신 스냅샷 형식이 올바르지 않아 기본값을 사용합니다.");
    return getPopularityEvidence;
  } catch (error) {
    console.error("[recommend/popularity] 최신 스냅샷 조회에 실패해 기본값을 사용합니다.", {
      name: error instanceof Error ? error.name : "Unknown",
    });
    return getPopularityEvidence;
  }
}

function toStoredBatch(
  entries: readonly ResolvedFuelPopularityEntry[]
): Prisma.InputJsonValue {
  const batch: StoredFuelPopularityBatch = {
    version: STORED_FUEL_POPULARITY_VERSION,
    entries: entries.map((entry) => ({
      fuelType: entry.fuelType,
      rank: entry.rank,
      brand: entry.brand,
      model: entry.model,
      registrationCount: entry.registrationCount,
      sharePct: entry.sharePct,
      momPct: entry.momPct,
      vehicleSlug: entry.vehicleSlug,
    })),
  };
  return batch as unknown as Prisma.InputJsonValue;
}

interface NiceFuelRankingResponse {
  readonly fuelType: NicePopularityFuelType;
  readonly parsed: ParsedNiceModelRanking;
}

async function fetchNiceFuelRanking(
  fuelType: NicePopularityFuelType
): Promise<NiceFuelRankingResponse> {
  const sourceUrl = getNiceModelRankingUrl(fuelType);
  const response = await fetch(sourceUrl, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "im-dealer-popularity-refresh/2.0 (+https://im-dealer.kr)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`NICE ${fuelType} 모델 순위 요청 실패: HTTP ${response.status}`);
  }
  const html = await response.text();
  if (html.length === 0 || html.length > MAX_SOURCE_HTML_BYTES) {
    throw new RangeError(`NICE ${fuelType} 모델 순위 응답 크기가 허용 범위를 벗어났습니다.`);
  }
  return {
    fuelType,
    parsed: parseNiceModelRankingHtml(html),
  };
}

function emptyMappedCount(): Record<NicePopularityFuelType, number> {
  return { gasoline: 0, diesel: 0, hybrid: 0, electric: 0 };
}

export interface PopularityRefreshResult {
  readonly period: string;
  readonly sourceUrl: string;
  readonly mappedEntries: number;
  readonly mappedEntriesByFuel: Readonly<Record<NicePopularityFuelType, number>>;
  readonly unmatchedEntries: readonly {
    fuelType: NicePopularityFuelType;
    rank: number;
    brand: string;
    model: string;
  }[];
}

/** NICE 연료별 1~30위 네 목록 → 내부 slug 매핑 → 단일 월 배치 upsert. */
export async function refreshPopularitySnapshotFromNice(): Promise<PopularityRefreshResult> {
  const rankings = await Promise.all(
    NICE_POPULARITY_FUEL_TYPES.map((fuelType) => fetchNiceFuelRanking(fuelType))
  );
  const period = rankings[0]?.parsed.period;
  if (!period || rankings.some((ranking) => ranking.parsed.period !== period)) {
    throw new RangeError("NICE 연료별 모델 순위의 기준월이 서로 다릅니다.");
  }

  const catalog = await prisma.vehicle.findMany({
    where: { isVisible: true },
    select: { slug: true, brand: true, name: true },
  });
  const entries: ResolvedFuelPopularityEntry[] = rankings.flatMap((ranking) =>
    resolveNiceModelRankingEntries(ranking.parsed.entries, catalog).map((entry) => ({
      ...entry,
      fuelType: ranking.fuelType,
    }))
  );

  const mappedEntriesByFuel = emptyMappedCount();
  for (const entry of entries) {
    if (entry.vehicleSlug !== null) mappedEntriesByFuel[entry.fuelType] += 1;
  }
  const mappedEntries = Object.values(mappedEntriesByFuel)
    .reduce((total, count) => total + count, 0);
  const insufficientFuel = NICE_POPULARITY_FUEL_TYPES.find(
    (fuelType) => mappedEntriesByFuel[fuelType] < MINIMUM_MAPPED_ENTRIES_PER_FUEL
  );
  if (mappedEntries < MINIMUM_TOTAL_MAPPED_ENTRIES || insufficientFuel) {
    throw new RangeError(
      `NICE 연료별 순위의 내부 차량 매핑이 너무 적습니다: total=${mappedEntries}, `
      + NICE_POPULARITY_FUEL_TYPES
        .map((fuelType) => `${fuelType}=${mappedEntriesByFuel[fuelType]}`)
        .join(",")
    );
  }

  const storedBatch = toStoredBatch(entries);
  if (!parseStoredFuelPopularitySnapshot(period, storedBatch)) {
    throw new RangeError("NICE 연료별 월간 스냅샷 검증에 실패했습니다.");
  }

  const fetchedAt = new Date();
  await prisma.recommendationPopularitySnapshot.upsert({
    where: { period },
    create: {
      period,
      sourceUrl: NICE_MODEL_RANKING_URL,
      fetchedAt,
      entries: storedBatch,
    },
    update: {
      sourceUrl: NICE_MODEL_RANKING_URL,
      fetchedAt,
      entries: storedBatch,
    },
  });

  return {
    period,
    sourceUrl: NICE_MODEL_RANKING_URL,
    mappedEntries,
    mappedEntriesByFuel,
    unmatchedEntries: entries
      .filter((entry) => entry.vehicleSlug === null)
      .map((entry) => ({
        fuelType: entry.fuelType,
        rank: entry.rank,
        brand: entry.brand,
        model: entry.model,
      })),
  };
}

export function popularityEvidenceForSnapshot(
  period: string,
  entries: unknown,
  fuelPreference?: string
): ((slug: string) => RecommendationPopularityEvidence) | null {
  const fuelSnapshot = parseStoredFuelPopularitySnapshot(period, entries);
  if (fuelSnapshot) return createFuelPopularityEvidenceLookup(fuelSnapshot, fuelPreference);

  const legacySnapshot = parseLegacyStoredSnapshot(period, entries);
  return legacySnapshot ? createPopularityEvidenceLookup(legacySnapshot) : null;
}
