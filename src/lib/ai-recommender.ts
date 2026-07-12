import type { RecommendInput, RecommendedVehicle } from "@/types/recommendation";
import { getRecommendEngineVersion } from "./recommend/recommend-engine-version";
import { recommendLegacyV1 } from "./recommend/recommend-legacy-v1";
import { recommendOverlapV2 } from "./recommend/recommend-overlap-v2";

export { recommendLegacyV1, recommendOverlapV2 };

export interface RecommendEngineDependencies {
  readonly version: () => "legacy-v1" | "overlap-v2";
  readonly legacy: (input: RecommendInput) => Promise<RecommendedVehicle[]>;
  readonly overlap: (input: RecommendInput) => Promise<RecommendedVehicle[]>;
}

export async function recommendWithEngines(
  input: RecommendInput,
  dependencies: RecommendEngineDependencies
): Promise<RecommendedVehicle[]> {
  return dependencies.version() === "overlap-v2"
    ? dependencies.overlap(input)
    : dependencies.legacy(input);
}

export async function recommend(input: RecommendInput): Promise<RecommendedVehicle[]> {
  return recommendWithEngines(input, {
    version: getRecommendEngineVersion,
    legacy: recommendLegacyV1,
    overlap: recommendOverlapV2,
  });
}
