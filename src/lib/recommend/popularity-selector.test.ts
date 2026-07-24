import { describe, expect, it } from "vitest";
import {
  selectRecommendationCandidates,
  type RecommendationSelectionCandidate,
} from "./popularity-selector";

function candidate(
  overrides: Partial<RecommendationSelectionCandidate>
    & Pick<RecommendationSelectionCandidate, "slug">
): RecommendationSelectionCandidate {
  return {
    fitScore: 10,
    compatibility: "compatible",
    popularity: {
      period: "2026-05",
      rank: null,
      registrationCount: null,
    },
    ...overrides,
  };
}

function select(
  candidates: readonly RecommendationSelectionCandidate[],
  variationSeed?: string
): readonly RecommendationSelectionCandidate[] {
  return selectRecommendationCandidates({
    candidates,
    compareDeterministic: (left, right) => left.slug.localeCompare(right.slug),
    variationSeed,
  });
}

describe("popularity-tier recommendation selector", () => {
  it("excludes compatible unranked candidates even when their fit score is higher", () => {
    const ranked = candidate({
      slug: "ranked",
      fitScore: 1,
      popularity: {
        period: "2026-05",
        rank: 20,
        registrationCount: 100,
      },
    });
    const unranked = candidate({ slug: "unranked", fitScore: 100 });

    expect(select([unranked, ranked]).map((item) => item.slug)).toEqual([
      "ranked",
    ]);
  });

  it("keeps fit score ahead of popularity rank within the ranked tier", () => {
    const popular = candidate({
      slug: "popular",
      fitScore: 10,
      popularity: {
        period: "2026-05",
        rank: 1,
        registrationCount: 1_000,
      },
    });
    const betterFit = candidate({
      slug: "better-fit",
      fitScore: 20,
      popularity: {
        period: "2026-05",
        rank: 30,
        registrationCount: 100,
      },
    });

    expect(select([popular, betterFit]).map((item) => item.slug)).toEqual([
      "better-fit",
      "popular",
    ]);
  });

  it("uses popularity rank after equal fit", () => {
    const rank20 = candidate({
      slug: "rank-20",
      popularity: {
        period: "2026-05",
        rank: 20,
        registrationCount: 100,
      },
    });
    const rank2 = candidate({
      slug: "rank-2",
      popularity: {
        period: "2026-05",
        rank: 2,
        registrationCount: 200,
      },
    });

    expect(select([rank20, rank2]).map((item) => item.slug)).toEqual([
      "rank-2",
      "rank-20",
    ]);
  });

  it("does not fill a short ranked list with compatible unranked candidates", () => {
    const rank2 = candidate({
      slug: "rank-2",
      popularity: {
        period: "2026-05",
        rank: 2,
        registrationCount: 200,
      },
    });
    const rank20 = candidate({
      slug: "rank-20",
      popularity: {
        period: "2026-05",
        rank: 20,
        registrationCount: 100,
      },
    });
    const fallback = candidate({ slug: "fallback" });

    expect(select([fallback, rank20, rank2]).map((item) => item.slug)).toEqual([
      "rank-2",
      "rank-20",
    ]);
  });

  it("never fills from a conflicting candidate or an unranked fallback", () => {
    const conflict = candidate({
      slug: "rank-one-conflict",
      compatibility: "conflict",
      popularity: {
        period: "2026-05",
        rank: 1,
        registrationCount: 1_000,
      },
    });
    const compatible = candidate({ slug: "compatible" });

    expect(select([conflict, compatible]).map((item) => item.slug)).toEqual([
    ]);
  });

  it("rotates only vehicles from the same nearby popularity band per request", () => {
    const ranks = [1, 2, 3].map((rank) => candidate({
      slug: `rank-${rank}`,
      popularity: {
        period: "2026-05",
        rank,
        registrationCount: 100,
      },
    }));

    expect(select(ranks).map((item) => item.slug)).toEqual([
      "rank-1",
      "rank-2",
      "rank-3",
    ]);
    expect(select(ranks, "a").map((item) => item.slug)).toEqual([
      "rank-3",
      "rank-1",
      "rank-2",
    ]);
  });

  it("returns an empty result when every candidate conflicts", () => {
    expect(select([
      candidate({ slug: "a", compatibility: "conflict" }),
      candidate({ slug: "b", compatibility: "conflict" }),
    ])).toEqual([]);
  });

  it("is deterministic across shuffled input", () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      candidate({
        slug: `vehicle-${index}`,
        popularity: {
          period: "2026-05",
          rank: index + 1,
          registrationCount: 100,
        },
      })
    );
    const expected = select(candidates).map((item) => item.slug);

    for (let index = 0; index < 20; index += 1) {
      const shuffled = [...candidates].sort((left, right) =>
        (left.slug.charCodeAt(left.slug.length - 1) * (index + 3)) % 11
        - (right.slug.charCodeAt(right.slug.length - 1) * (index + 3)) % 11
      );
      expect(select(shuffled).map((item) => item.slug)).toEqual(expected);
    }
  });
});
