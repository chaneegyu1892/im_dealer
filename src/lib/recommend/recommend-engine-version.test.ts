import { describe, expect, it } from "vitest";
import { getRecommendEngineVersion } from "./recommend-engine-version";

describe("recommend engine version", () => {
  it("defaults to legacy during rollout readiness", () => {
    expect(getRecommendEngineVersion(undefined)).toBe("legacy-v1");
    expect(getRecommendEngineVersion("")).toBe("legacy-v1");
    expect(getRecommendEngineVersion("legacy-v1")).toBe("legacy-v1");
  });

  it("selects v2 only by its exact value and rejects typos", () => {
    expect(getRecommendEngineVersion("overlap-v2")).toBe("overlap-v2");
    expect(() => getRecommendEngineVersion("v2")).toThrow(/Invalid RECOMMEND_ENGINE_VERSION/);
  });

  it("selects STEP 02 v3 only by its exact value", () => {
    expect(getRecommendEngineVersion("step02-v3")).toBe("step02-v3");
  });
});
