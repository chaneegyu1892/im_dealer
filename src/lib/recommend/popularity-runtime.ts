import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecommendationPopularityEvidence } from "@/types/recommendation";
import {
  NICE_MODEL_RANKING_URL,
  NICE_POPULARITY_COUNT,
  parseNiceModelRankingHtml,
  resolveNiceModelRankingEntries,
  type ResolvedNiceModelRankingEntry,
} from "./nice-popularity";
import {
  createPopularityEvidenceLookup,
  getPopularityEvidence,
  type PopularityEvidenceLookup,
  type PopularitySnapshot,
} from "./popularity-snapshot";

const MAX_SOURCE_HTML_BYTES = 1_000_000;
const MINIMUM_MAPPED_ENTRIES = 15;

interface StoredPopularityEntry {
  readonly rank: number;
  readonly registrationCount: number;
  readonly vehicleSlug: string | null;
}

function isStoredPopularityEntry(value: unknown): value is StoredPopularityEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return Number.isInteger(entry.rank)
    && typeof entry.registrationCount === "number"
    && Number.isInteger(entry.registrationCount)
    && entry.registrationCount > 0
    && (typeof entry.vehicleSlug === "string" || entry.vehicleSlug === null);
}

function parseStoredSnapshot(
  period: string,
  value: unknown
): PopularitySnapshot | null {
  if (!Array.isArray(value) || value.length !== NICE_POPULARITY_COUNT) return null;
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)) return null;
  if (!value.every(isStoredPopularityEntry)) return null;

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
 * 최신 성공 스냅샷만 추천에 사용한다. DB가 잠시 불가하거나 아직 첫 수집 전이면
 * 배포본에 포함한 검증된 2026-05 스냅샷으로 안전하게 계속 추천한다.
 */
export async function loadCurrentPopularityEvidenceLookup(): Promise<PopularityEvidenceLookup> {
  try {
    const snapshot = await prisma.recommendationPopularitySnapshot.findFirst({
      orderBy: [{ period: "desc" }],
      select: { period: true, entries: true },
    });
    if (!snapshot) return getPopularityEvidence;
    const parsed = parseStoredSnapshot(snapshot.period, snapshot.entries);
    if (!parsed) {
      console.error("[recommend/popularity] 최신 스냅샷 형식이 올바르지 않아 기본값을 사용합니다.");
      return getPopularityEvidence;
    }
    return createPopularityEvidenceLookup(parsed);
  } catch (error) {
    console.error("[recommend/popularity] 최신 스냅샷 조회에 실패해 기본값을 사용합니다.", {
      name: error instanceof Error ? error.name : "Unknown",
    });
    return getPopularityEvidence;
  }
}

function toStoredEntries(
  entries: readonly ResolvedNiceModelRankingEntry[]
): Prisma.InputJsonValue {
  return entries.map((entry) => ({
    rank: entry.rank,
    brand: entry.brand,
    model: entry.model,
    registrationCount: entry.registrationCount,
    sharePct: entry.sharePct,
    momPct: entry.momPct,
    vehicleSlug: entry.vehicleSlug,
  })) as Prisma.InputJsonValue;
}

export interface PopularityRefreshResult {
  readonly period: string;
  readonly sourceUrl: string;
  readonly mappedEntries: number;
  readonly unmatchedEntries: readonly {
    rank: number;
    brand: string;
    model: string;
  }[];
}

/** NICE 공개 순위 → 내부 slug 매핑 → DB upsert. */
export async function refreshPopularitySnapshotFromNice(): Promise<PopularityRefreshResult> {
  const response = await fetch(NICE_MODEL_RANKING_URL, {
    cache: "no-store",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "im-dealer-popularity-refresh/1.0 (+https://im-dealer.kr)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`NICE 모델 순위 요청 실패: HTTP ${response.status}`);
  }
  const html = await response.text();
  if (html.length === 0 || html.length > MAX_SOURCE_HTML_BYTES) {
    throw new RangeError("NICE 모델 순위 응답 크기가 허용 범위를 벗어났습니다.");
  }

  const parsed = parseNiceModelRankingHtml(html);
  const catalog = await prisma.vehicle.findMany({
    where: { isVisible: true },
    select: { slug: true, brand: true, name: true },
  });
  const entries = resolveNiceModelRankingEntries(parsed.entries, catalog);
  const mappedEntries = entries.filter((entry) => entry.vehicleSlug !== null);
  if (mappedEntries.length < MINIMUM_MAPPED_ENTRIES) {
    throw new RangeError(
      `NICE 순위의 내부 차량 매핑이 너무 적습니다: ${mappedEntries.length}/${NICE_POPULARITY_COUNT}`
    );
  }

  await prisma.recommendationPopularitySnapshot.upsert({
    where: { period: parsed.period },
    create: {
      period: parsed.period,
      sourceUrl: NICE_MODEL_RANKING_URL,
      fetchedAt: new Date(),
      entries: toStoredEntries(entries),
    },
    update: {
      sourceUrl: NICE_MODEL_RANKING_URL,
      fetchedAt: new Date(),
      entries: toStoredEntries(entries),
    },
  });

  return {
    period: parsed.period,
    sourceUrl: NICE_MODEL_RANKING_URL,
    mappedEntries: mappedEntries.length,
    unmatchedEntries: entries
      .filter((entry) => entry.vehicleSlug === null)
      .map((entry) => ({ rank: entry.rank, brand: entry.brand, model: entry.model })),
  };
}

export function popularityEvidenceForSnapshot(
  period: string,
  entries: unknown
): ((slug: string) => RecommendationPopularityEvidence) | null {
  const snapshot = parseStoredSnapshot(period, entries);
  return snapshot ? createPopularityEvidenceLookup(snapshot) : null;
}
