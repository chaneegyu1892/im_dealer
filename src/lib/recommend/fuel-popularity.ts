import { z } from "zod";
import type { RecommendationPopularityEvidence } from "@/types/recommendation";
import {
  NICE_POPULARITY_COUNT,
  NICE_POPULARITY_FUEL_TYPES,
  NICE_POPULARITY_TOTAL_COUNT,
  type NicePopularityFuelType,
} from "./nice-popularity";
import type { PopularityEvidenceLookup } from "./popularity-snapshot";

export const STORED_FUEL_POPULARITY_VERSION = 2 as const;

export type RecommendPopularityFuelPreference =
  | "상관없음"
  | "가솔린/디젤"
  | "하이브리드"
  | "전기차";

const storedFuelPopularityEntrySchema = z.object({
  fuelType: z.enum(NICE_POPULARITY_FUEL_TYPES),
  rank: z.number().int().min(1).max(NICE_POPULARITY_COUNT),
  brand: z.string().min(1),
  model: z.string().min(1),
  registrationCount: z.number().int().positive(),
  sharePct: z.number().finite().min(0).max(1),
  momPct: z.number().finite(),
  vehicleSlug: z.string().min(1).nullable(),
}).strict();

const storedFuelPopularityBatchSchema = z.object({
  version: z.literal(STORED_FUEL_POPULARITY_VERSION),
  entries: z.array(storedFuelPopularityEntrySchema).length(NICE_POPULARITY_TOTAL_COUNT),
}).strict().superRefine((batch, context) => {
  for (const fuelType of NICE_POPULARITY_FUEL_TYPES) {
    const entries = batch.entries.filter((entry) => entry.fuelType === fuelType);
    if (entries.length !== NICE_POPULARITY_COUNT) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: `${fuelType} 순위가 ${NICE_POPULARITY_COUNT}개가 아닙니다.`,
      });
      continue;
    }

    const ranks = entries.map((entry) => entry.rank).sort((left, right) => left - right);
    if (ranks.some((rank, index) => rank !== index + 1)) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: `${fuelType} 순위가 1위부터 ${NICE_POPULARITY_COUNT}위까지 연속되지 않습니다.`,
      });
    }

    const mappedSlugs = entries.flatMap((entry) =>
      entry.vehicleSlug === null ? [] : [entry.vehicleSlug]
    );
    if (new Set(mappedSlugs).size !== mappedSlugs.length) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: `${fuelType} 순위에 중복 매핑된 차량이 있습니다.`,
      });
    }
  }
});

export type StoredFuelPopularityEntry = z.infer<typeof storedFuelPopularityEntrySchema>;
export type StoredFuelPopularityBatch = z.infer<typeof storedFuelPopularityBatchSchema>;

export interface FuelPopularitySnapshotEntry {
  readonly fuelType: NicePopularityFuelType;
  readonly sourceRank: number;
  readonly slug: string;
  readonly registrationCount: number;
}

export interface FuelPopularitySnapshot {
  readonly period: string;
  readonly entries: readonly FuelPopularitySnapshotEntry[];
}

export interface RankedFuelPopularityEntry {
  readonly rank: number;
  readonly slug: string;
  readonly registrationCount: number;
  readonly sourceFuelType: NicePopularityFuelType;
  readonly sourceRank: number;
}

export function parseStoredFuelPopularitySnapshot(
  period: string,
  value: unknown
): FuelPopularitySnapshot | null {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period)) return null;
  const parsed = storedFuelPopularityBatchSchema.safeParse(value);
  if (!parsed.success) return null;

  return {
    period,
    entries: parsed.data.entries.flatMap((entry) =>
      entry.vehicleSlug === null
        ? []
        : [{
            fuelType: entry.fuelType,
            sourceRank: entry.rank,
            slug: entry.vehicleSlug,
            registrationCount: entry.registrationCount,
          }]
    ),
  };
}

export function getNiceFuelTypesForPreference(
  preference: string | undefined
): readonly NicePopularityFuelType[] {
  if (preference === undefined || preference === "상관없음") {
    return NICE_POPULARITY_FUEL_TYPES;
  }
  if (preference === "가솔린/디젤") return ["gasoline", "diesel"];
  if (preference === "하이브리드") return ["hybrid"];
  if (preference === "전기차") return ["electric"];
  throw new RangeError(`지원하지 않는 추천 연료 선호입니다: ${preference}`);
}

const FUEL_ORDER = new Map(
  NICE_POPULARITY_FUEL_TYPES.map((fuelType, index) => [fuelType, index])
);

function compareSourceEntries(
  left: FuelPopularitySnapshotEntry,
  right: FuelPopularitySnapshotEntry
): number {
  if (left.registrationCount !== right.registrationCount) {
    return right.registrationCount - left.registrationCount;
  }
  if (left.sourceRank !== right.sourceRank) return left.sourceRank - right.sourceRank;
  const fuelOrder = (FUEL_ORDER.get(left.fuelType) ?? 0) - (FUEL_ORDER.get(right.fuelType) ?? 0);
  return fuelOrder !== 0 ? fuelOrder : left.slug.localeCompare(right.slug);
}

/**
 * 선택한 연료별 30위 목록을 절대 등록대수 기준의 하나의 후보 순위로 합친다.
 * 같은 내부 차량이 여러 연료 목록에 있으면 등록대수가 가장 큰 항목만 사용한다.
 */
export function rankFuelPopularityEntries(
  snapshot: FuelPopularitySnapshot,
  preference: string | undefined
): RankedFuelPopularityEntry[] {
  const selectedFuelTypes = new Set(getNiceFuelTypesForPreference(preference));
  const bestEntryBySlug = new Map<string, FuelPopularitySnapshotEntry>();

  for (const entry of snapshot.entries) {
    if (!selectedFuelTypes.has(entry.fuelType)) continue;
    const current = bestEntryBySlug.get(entry.slug);
    if (!current || compareSourceEntries(entry, current) < 0) {
      bestEntryBySlug.set(entry.slug, entry);
    }
  }

  return [...bestEntryBySlug.values()]
    .sort(compareSourceEntries)
    .map((entry, index) => ({
      rank: index + 1,
      slug: entry.slug,
      registrationCount: entry.registrationCount,
      sourceFuelType: entry.fuelType,
      sourceRank: entry.sourceRank,
    }));
}

export function createFuelPopularityEvidenceLookup(
  snapshot: FuelPopularitySnapshot,
  preference: string | undefined
): PopularityEvidenceLookup {
  const popularityBySlug = new Map(
    rankFuelPopularityEntries(snapshot, preference).map((entry) => [entry.slug, entry])
  );

  return (slug): RecommendationPopularityEvidence => {
    const entry = popularityBySlug.get(slug);
    return {
      period: snapshot.period,
      rank: entry?.rank ?? null,
      registrationCount: entry?.registrationCount ?? null,
    };
  };
}
