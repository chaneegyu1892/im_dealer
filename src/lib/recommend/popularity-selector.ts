import type { RecommendationPopularityEvidence } from "@/types/recommendation";

export type RecommendationCompatibility = "compatible" | "conflict";

export interface RecommendationSelectionCandidate {
  readonly slug: string;
  readonly fitScore: number;
  readonly compatibility: RecommendationCompatibility;
  readonly popularity: RecommendationPopularityEvidence;
}

interface RecommendationSelectionInput<
  Candidate extends RecommendationSelectionCandidate,
> {
  readonly candidates: readonly Candidate[];
  readonly compareDeterministic: (left: Candidate, right: Candidate) => number;
}

export function selectRecommendationCandidates<
  Candidate extends RecommendationSelectionCandidate,
>({
  candidates,
  compareDeterministic,
}: RecommendationSelectionInput<Candidate>): Candidate[] {
  return candidates
    .filter((candidate) => candidate.compatibility === "compatible")
    .sort((left, right) => {
      const leftRank = left.popularity.rank;
      const rightRank = right.popularity.rank;
      if (leftRank === null && rightRank !== null) return 1;
      if (leftRank !== null && rightRank === null) return -1;
      if (left.fitScore !== right.fitScore) {
        return right.fitScore - left.fitScore;
      }
      if (leftRank !== null && rightRank !== null && leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return compareDeterministic(left, right);
    })
    .slice(0, 3);
}
