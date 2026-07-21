export type RecommendEngineVersion = "legacy-v1" | "overlap-v2" | "step02-v3";

export function getRecommendEngineVersion(
  value: string | undefined = process.env.RECOMMEND_ENGINE_VERSION
): RecommendEngineVersion {
  if (value === undefined || value === "" || value === "legacy-v1") return "legacy-v1";
  if (value === "overlap-v2") return "overlap-v2";
  if (value === "step02-v3") return "step02-v3";
  throw new Error(`Invalid RECOMMEND_ENGINE_VERSION: ${value}`);
}
