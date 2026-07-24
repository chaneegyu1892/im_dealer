import { z } from "zod";
import type { RecommendationPopularityEvidence } from "@/types/recommendation";
import rawSnapshot from "./data/newcar-popularity-2026-05.json";

export const POPULARITY_PERIOD = "2026-05" as const;
const POPULARITY_COUNT = 30;

const sourceVehicleSchema = z.object({
  rank: z.number().int().min(1).max(POPULARITY_COUNT),
  cartype: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  registration_count: z.number().int().positive(),
  share_pct: z.number().finite().min(0).max(1),
  mom_pct: z.number().finite().min(-1),
  popularity_score: z.number().finite().min(0).max(100),
}).strict();

const sourceSnapshotSchema = z.object({
  source: z.string().min(1),
  basis: z.string().includes("2026년 05월"),
  note: z.string().min(1),
  generated_for: z.string().min(1),
  count: z.literal(POPULARITY_COUNT),
  vehicles: z.array(sourceVehicleSchema).length(POPULARITY_COUNT),
}).strict().superRefine((snapshot, context) => {
  const ranks = snapshot.vehicles.map((vehicle) => vehicle.rank);
  if (new Set(ranks).size !== POPULARITY_COUNT) {
    context.addIssue({
      code: "custom",
      path: ["vehicles"],
      message: "인기순위는 1위부터 30위까지 중복 없이 존재해야 합니다.",
    });
  }
  for (let rank = 1; rank <= POPULARITY_COUNT; rank += 1) {
    if (!ranks.includes(rank)) {
      context.addIssue({
        code: "custom",
        path: ["vehicles"],
        message: `인기순위 ${rank}위가 누락되었습니다.`,
      });
    }
  }
});

const slugMappingSchema = z.array(z.object({
  rank: z.number().int().min(1).max(POPULARITY_COUNT),
  slug: z.string().min(1),
}).strict()).length(POPULARITY_COUNT).superRefine((mapping, context) => {
  const ranks = mapping.map((entry) => entry.rank);
  const slugs = mapping.map((entry) => entry.slug);
  if (new Set(ranks).size !== POPULARITY_COUNT) {
    context.addIssue({
      code: "custom",
      message: "인기순위 slug 매핑은 모든 순위를 한 번씩 포함해야 합니다.",
    });
  }
  if (new Set(slugs).size !== POPULARITY_COUNT) {
    context.addIssue({
      code: "custom",
      message: "인기순위 slug 매핑에 중복 차량이 있습니다.",
    });
  }
  for (let rank = 1; rank <= POPULARITY_COUNT; rank += 1) {
    if (!ranks.includes(rank)) {
      context.addIssue({
        code: "custom",
        message: `인기순위 ${rank}위의 slug 매핑이 누락되었습니다.`,
      });
    }
  }
});

export const POPULARITY_SLUG_MAPPING = [
  { rank: 1, slug: "tesla-11738" },
  { rank: 2, slug: "kia-11573" },
  { rank: 3, slug: "hyundai-11462" },
  { rank: 4, slug: "kia-11606" },
  { rank: 5, slug: "hyundai-11414" },
  { rank: 6, slug: "hyundai-10014" },
  { rank: 7, slug: "kia-11722" },
  { rank: 8, slug: "kia-11116" },
  { rank: 9, slug: "kia-11681" },
  { rank: 10, slug: "kia-11562" },
  { rank: 11, slug: "kia-11818" },
  { rank: 12, slug: "hyundai-11576" },
  { rank: 13, slug: "hyundai-11664" },
  { rank: 14, slug: "hyundai-11294" },
  { rank: 15, slug: "kia-11792" },
  { rank: 16, slug: "bmw-11584" },
  { rank: 17, slug: "kia-10047" },
  { rank: 18, slug: "kia-11844" },
  { rank: 19, slug: "genesis-11644" },
  { rank: 20, slug: "kia-11597" },
  { rank: 21, slug: "hyundai-11260" },
  { rank: 22, slug: "hyundai-11396" },
  { rank: 23, slug: "genesis-10534" },
  { rank: 24, slug: "renault-11842" },
  { rank: 25, slug: "hyundai-11609" },
  { rank: 26, slug: "hyundai-11744" },
  { rank: 27, slug: "tesla-11670" },
  { rank: 28, slug: "benz-11651" },
  { rank: 29, slug: "genesis-11593" },
  { rank: 30, slug: "kia-11760" },
] as const;

export interface PopularitySnapshotEntry {
  readonly rank: number;
  readonly slug: string;
  readonly registrationCount: number;
}

export interface PopularitySnapshot {
  readonly period: string;
  readonly entries: readonly PopularitySnapshotEntry[];
}

export type PopularityEvidenceLookup = (
  slug: string
) => RecommendationPopularityEvidence;

export function parsePopularitySnapshot(
  value: unknown,
  mappingValue: unknown
): PopularitySnapshot {
  const snapshot = sourceSnapshotSchema.parse(value);
  const mapping = slugMappingSchema.parse(mappingValue);
  const slugByRank = new Map(mapping.map((entry) => [entry.rank, entry.slug]));

  return {
    period: POPULARITY_PERIOD,
    entries: [...snapshot.vehicles]
      .sort((left, right) => left.rank - right.rank)
      .map((vehicle) => {
        const slug = slugByRank.get(vehicle.rank);
        if (!slug) {
          throw new RangeError(`Missing popularity slug mapping for rank ${vehicle.rank}`);
        }
        return {
          rank: vehicle.rank,
          slug,
          registrationCount: vehicle.registration_count,
        };
      }),
  };
}

export const MAY_2026_POPULARITY = parsePopularitySnapshot(
  rawSnapshot,
  POPULARITY_SLUG_MAPPING
);

export function createPopularityEvidenceLookup(
  snapshot: PopularitySnapshot
): PopularityEvidenceLookup {
  const popularityBySlug = new Map(
    snapshot.entries.map((entry) => [entry.slug, entry])
  );

  return (slug) => {
    const entry = popularityBySlug.get(slug);
    return {
      period: snapshot.period,
      rank: entry?.rank ?? null,
      registrationCount: entry?.registrationCount ?? null,
    };
  };
}

const getStaticPopularityEvidence = createPopularityEvidenceLookup(
  MAY_2026_POPULARITY
);

/**
 * DB에 아직 월간 수집 스냅샷이 없거나 레거시 엔진이 사용하는 기본값이다.
 * 실제 step02-v3 추천은 popularity-runtime의 최신 저장 스냅샷을 주입한다.
 */
export function getPopularityEvidence(slug: string): RecommendationPopularityEvidence {
  return getStaticPopularityEvidence(slug);
}
