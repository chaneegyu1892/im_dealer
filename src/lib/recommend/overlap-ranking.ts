import type { FuelGroup, OverlapProfile } from "./overlap-profile";
import type { OverlapScoreResult } from "./overlap-scoring";

export type FuelPreference = "상관없음" | "가솔린/디젤" | "하이브리드" | "전기차";

export interface RankableOverlapCandidate {
  readonly vehicleId: string;
  readonly slug: string;
  readonly modelKey: string;
  readonly modelYear: number;
  readonly isPopular: boolean;
  readonly profile: OverlapProfile;
  readonly score: OverlapScoreResult;
}

export function requiredFuelGroup(preference: FuelPreference): FuelGroup | null {
  if (preference === "전기차") return "EV";
  if (preference === "하이브리드") return "HEV";
  if (preference === "가솔린/디젤") return "ICE";
  return null;
}

export function compareOverlapCandidates(
  left: RankableOverlapCandidate,
  right: RankableOverlapCandidate
): number {
  if (left.score.rankScore !== right.score.rankScore) {
    return right.score.rankScore - left.score.rankScore;
  }
  if (left.modelYear !== right.modelYear) return right.modelYear - left.modelYear;
  if (left.profile.companyPriority !== right.profile.companyPriority) {
    return right.profile.companyPriority - left.profile.companyPriority;
  }
  if (left.isPopular !== right.isPopular) return left.isPopular ? -1 : 1;
  if (left.profile.profitPriority !== right.profile.profitPriority) {
    return right.profile.profitPriority - left.profile.profitPriority;
  }
  return left.slug.localeCompare(right.slug);
}

function deduplicateLatestModel(
  candidates: readonly RankableOverlapCandidate[]
): RankableOverlapCandidate[] {
  const byModel = new Map<string, RankableOverlapCandidate>();
  for (const candidate of candidates) {
    const current = byModel.get(candidate.modelKey);
    if (
      !current
      || candidate.modelYear > current.modelYear
      || (candidate.modelYear === current.modelYear
        && compareOverlapCandidates(candidate, current) < 0)
    ) {
      byModel.set(candidate.modelKey, candidate);
    }
  }
  return [...byModel.values()];
}

export function rankOverlapCandidates(
  candidates: readonly RankableOverlapCandidate[],
  fuelPreference: FuelPreference
): RankableOverlapCandidate[] {
  const requiredFuel = requiredFuelGroup(fuelPreference);
  const matchingFuel = requiredFuel
    ? candidates.filter((candidate) => candidate.profile.fuelGroup === requiredFuel)
    : [...candidates];
  return deduplicateLatestModel(matchingFuel)
    .sort(compareOverlapCandidates)
    .slice(0, 3);
}
