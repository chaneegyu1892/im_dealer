import { latestByRecommendationModel } from "./latest-model";
import type { LegacyScoredVehicle } from "./recommend-legacy-results";
import { selectRecommendationCandidates } from "./popularity-selector";

export function selectLegacyRecommendationCandidates(
  candidates: readonly LegacyScoredVehicle[]
): LegacyScoredVehicle[] {
  const latestCandidates = latestByRecommendationModel(candidates);
  return selectRecommendationCandidates({
    candidates: latestCandidates.map((candidate) => ({
      ...candidate,
      slug: candidate.detail.slug,
      fitScore: candidate.score,
    })),
    compareDeterministic: (left, right) =>
      right.modelYear - left.modelYear
      || left.slug.localeCompare(right.slug),
  });
}
