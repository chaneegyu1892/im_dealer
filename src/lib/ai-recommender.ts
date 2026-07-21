import type { RecommendInput, RecommendedVehicle } from "@/types/recommendation";
import { getRecommendEngineVersion } from "./recommend/recommend-engine-version";
import { recommendLegacyV1 } from "./recommend/recommend-legacy-v1";
import { recommendOverlapV2 } from "./recommend/recommend-overlap-v2";
import { recommendStep02V3 } from "./recommend/recommend-step02-v3";
import type { RecommendEngineVersion } from "./recommend/recommend-engine-version";

export { recommendLegacyV1, recommendOverlapV2, recommendStep02V3 };

export interface RecommendEngineDependencies {
  readonly version: () => RecommendEngineVersion;
  readonly legacy: (input: RecommendInput) => Promise<RecommendedVehicle[]>;
  readonly overlap: (input: RecommendInput) => Promise<RecommendedVehicle[]>;
  readonly step02?: (input: RecommendInput) => Promise<RecommendedVehicle[]>;
}

export async function recommendWithEngines(
  input: RecommendInput,
  dependencies: RecommendEngineDependencies
): Promise<RecommendedVehicle[]> {
  const version = dependencies.version();
  if (version === "overlap-v2") return dependencies.overlap(input);
  if (version === "step02-v3") {
    if (!dependencies.step02) throw new Error("step02-v3 engine dependency is missing");
    return dependencies.step02(input);
  }
  return dependencies.legacy(input);
}

export async function recommendForVersion(
  input: RecommendInput,
  version: RecommendEngineVersion
): Promise<RecommendedVehicle[]> {
  return recommendWithEngines(input, {
    version: () => version,
    legacy: recommendLegacyV1,
    overlap: recommendOverlapV2,
    step02: recommendStep02V3,
  });
}

export async function recommend(input: RecommendInput): Promise<RecommendedVehicle[]> {
  return recommendForVersion(input, getRecommendEngineVersion());
}
