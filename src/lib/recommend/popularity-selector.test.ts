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
  candidates: readonly RecommendationSelectionCandidate[]
): readonly RecommendationSelectionCandidate[] {
  return selectRecommendationCandidates({
    candidates,
    compareDeterministic: (left, right) => left.slug.localeCompare(right.slug),
  });
}

describe("popularity-tier recommendation selector", () => {
  it("tiers compatible ranked candidates ahead of better-fit unranked candidates", () => {
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
      "unranked",
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

  it("fills one or two ranked candidates only with compatible unranked candidates", () => {
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
      "fallback",
    ]);
  });

  it("never fills from a conflicting candidate, including rank one", () => {
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
      "compatible",
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
      candidate({ slug: `vehicle-${index}` })
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
