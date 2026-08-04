import type { RecommendInput, RecommendedVehicle } from "@/types/recommendation";
import { getRecommendEngineVersion } from "./recommend/recommend-engine-version";
import { recommendLegacyV1 } from "./recommend/recommend-legacy-v1";
import { recommendOverlapV2 } from "./recommend/recommend-overlap-v2";
import { recommendStep02V3 } from "./recommend/recommend-step02-v3";
import type { RecommendEngineVersion } from "./recommend/recommend-engine-version";
import type { RecommendationSelectionOptions } from "./recommend/popularity-selector";

export { recommendLegacyV1, recommendOverlapV2, recommendStep02V3 };

/**
 * 근접 후보(예산 상한만 넘긴 차)는 step02-v3 에만 있는 개념이다. 옛 엔진은
 * 빈 목록으로 맞춰 호출부가 버전을 몰라도 되게 한다.
 */
export interface RecommendRun {
  readonly vehicles: RecommendedVehicle[];
  readonly nearMissVehicles: RecommendedVehicle[];
}

export interface RecommendEngineDependencies {
  readonly version: () => RecommendEngineVersion;
  readonly legacy: (input: RecommendInput, options?: RecommendationSelectionOptions) => Promise<RecommendedVehicle[]>;
  readonly overlap: (input: RecommendInput, options?: RecommendationSelectionOptions) => Promise<RecommendedVehicle[]>;
  readonly step02?: (input: RecommendInput, options?: RecommendationSelectionOptions) => Promise<RecommendRun>;
}

export async function recommendWithEngines(
  input: RecommendInput,
  dependencies: RecommendEngineDependencies,
  selectionOptions: RecommendationSelectionOptions = {}
): Promise<RecommendRun> {
  const version = dependencies.version();
  if (version === "overlap-v2") {
    return {
      vehicles: await dependencies.overlap(input, selectionOptions),
      nearMissVehicles: [],
    };
  }
  if (version === "step02-v3") {
    if (!dependencies.step02) throw new Error("step02-v3 engine dependency is missing");
    return dependencies.step02(input, selectionOptions);
  }
  return {
    vehicles: await dependencies.legacy(input, selectionOptions),
    nearMissVehicles: [],
  };
}

export async function recommendForVersion(
  input: RecommendInput,
  version: RecommendEngineVersion,
  selectionOptions: RecommendationSelectionOptions = {}
): Promise<RecommendRun> {
  return recommendWithEngines(input, {
    version: () => version,
    legacy: recommendLegacyV1,
    overlap: recommendOverlapV2,
    step02: recommendStep02V3,
  }, selectionOptions);
}

export async function recommend(input: RecommendInput): Promise<RecommendRun> {
  return recommendForVersion(input, getRecommendEngineVersion());
}
