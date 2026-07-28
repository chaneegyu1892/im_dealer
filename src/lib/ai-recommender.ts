import type { RecommendInput, RecommendedVehicle } from "@/types/recommendation";
import { getRecommendEngineVersion } from "./recommend/recommend-engine-version";
import { recommendLegacyV1 } from "./recommend/recommend-legacy-v1";
import { recommendOverlapV2 } from "./recommend/recommend-overlap-v2";
import { recommendStep02V3 } from "./recommend/recommend-step02-v3";
import type { RecommendEngineVersion } from "./recommend/recommend-engine-version";
import type { RecommendationSelectionOptions } from "./recommend/popularity-selector";

export { recommendLegacyV1, recommendOverlapV2, recommendStep02V3 };

export interface RecommendEngineDependencies {
  readonly version: () => RecommendEngineVersion;
  readonly legacy: (input: RecommendInput, options?: RecommendationSelectionOptions) => Promise<RecommendedVehicle[]>;
  readonly overlap: (input: RecommendInput, options?: RecommendationSelectionOptions) => Promise<RecommendedVehicle[]>;
  readonly step02?: (input: RecommendInput, options?: RecommendationSelectionOptions) => Promise<RecommendedVehicle[]>;
}

export async function recommendWithEngines(
  input: RecommendInput,
  dependencies: RecommendEngineDependencies,
  selectionOptions: RecommendationSelectionOptions = {}
): Promise<RecommendedVehicle[]> {
  const version = dependencies.version();
  if (version === "overlap-v2") return dependencies.overlap(input, selectionOptions);
  if (version === "step02-v3") {
    if (!dependencies.step02) throw new Error("step02-v3 engine dependency is missing");
    return dependencies.step02(input, selectionOptions);
  }
  return dependencies.legacy(input, selectionOptions);
}

export async function recommendForVersion(
  input: RecommendInput,
  version: RecommendEngineVersion,
  selectionOptions: RecommendationSelectionOptions = {}
): Promise<RecommendedVehicle[]> {
  return recommendWithEngines(input, {
    version: () => version,
    legacy: recommendLegacyV1,
    overlap: recommendOverlapV2,
    step02: recommendStep02V3,
  }, selectionOptions);
}

export async function recommend(input: RecommendInput): Promise<RecommendedVehicle[]> {
  return recommendForVersion(input, getRecommendEngineVersion());
}
