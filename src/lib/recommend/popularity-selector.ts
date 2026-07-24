import type { RecommendationPopularityEvidence } from "@/types/recommendation";

export type RecommendationCompatibility = "compatible" | "conflict";

export interface RecommendationSelectionCandidate {
  readonly slug: string;
  readonly fitScore: number;
  readonly compatibility: RecommendationCompatibility;
  readonly popularity: RecommendationPopularityEvidence;
}

export interface RecommendationSelectionOptions {
  /**
   * A request-scoped value that permits a small rotation among adjacent
   * popularity ranks. Omit it for deterministic internal callers and tests.
   */
  readonly variationSeed?: string;
}

interface RecommendationSelectionInput<
  Candidate extends RecommendationSelectionCandidate,
> extends RecommendationSelectionOptions {
  readonly candidates: readonly Candidate[];
  readonly compareDeterministic: (left: Candidate, right: Candidate) => number;
}

const NEARBY_POPULARITY_RANK_SPAN = 3;

function popularityBand(rank: number): number {
  return Math.floor((rank - 1) / NEARBY_POPULARITY_RANK_SPAN);
}

function seedToNumber(seed: string): number {
  let value = 0;
  for (const character of seed) {
    value = ((value * 31) + character.charCodeAt(0)) >>> 0;
  }
  return value;
}

/**
 * Keeps the selected vehicles in their priority order by default. For a new
 * customer request, only rows in the same three-rank popularity band rotate.
 */
export function mixNearbyPopularityCandidates<
  Candidate extends Pick<RecommendationSelectionCandidate, "popularity">,
>(
  candidates: readonly Candidate[],
  variationSeed?: string
): Candidate[] {
  if (!variationSeed) return [...candidates];

  const mixed: Candidate[] = [];
  for (let start = 0; start < candidates.length;) {
    const rank = candidates[start]?.popularity.rank;
    if (rank === null || rank === undefined) {
      mixed.push(candidates[start]!);
      start += 1;
      continue;
    }

    const band = popularityBand(rank);
    let end = start + 1;
    while (
      end < candidates.length
      && candidates[end]?.popularity.rank !== null
      && candidates[end]?.popularity.rank !== undefined
      && popularityBand(candidates[end]!.popularity.rank!) === band
    ) {
      end += 1;
    }

    const group = candidates.slice(start, end);
    const offset = seedToNumber(`${variationSeed}:${band}`) % group.length;
    mixed.push(...group.slice(offset), ...group.slice(0, offset));
    start = end;
  }
  return mixed;
}

export function selectRecommendationCandidates<
  Candidate extends RecommendationSelectionCandidate,
>({
  candidates,
  compareDeterministic,
  variationSeed,
}: RecommendationSelectionInput<Candidate>): Candidate[] {
  const selected = candidates
    .filter((candidate) =>
      candidate.compatibility === "compatible"
      && candidate.popularity.rank !== null
    )
    .sort((left, right) => {
      const leftRank = left.popularity.rank;
      const rightRank = right.popularity.rank;
      if (leftRank === null) return 1;
      if (rightRank === null) return -1;
      if (left.fitScore !== right.fitScore) {
        return right.fitScore - left.fitScore;
      }
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return compareDeterministic(left, right);
    })
    .slice(0, 3);

  return mixNearbyPopularityCandidates(selected, variationSeed);
}
