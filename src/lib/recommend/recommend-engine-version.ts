export type RecommendEngineVersion = "legacy-v1" | "overlap-v2";

export function getRecommendEngineVersion(
  value: string | undefined = process.env.RECOMMEND_ENGINE_VERSION
): RecommendEngineVersion {
  if (value === undefined || value === "" || value === "legacy-v1") return "legacy-v1";
  if (value === "overlap-v2") return "overlap-v2";
  throw new Error(`Invalid RECOMMEND_ENGINE_VERSION: ${value}`);
}
