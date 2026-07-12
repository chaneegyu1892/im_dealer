import { describe, expect, it, vi } from "vitest";
import type { RecommendInput } from "@/types/recommendation";
import { recommendWithEngines } from "./ai-recommender";

const input: RecommendInput = {
  industry: "개인",
  industryDetail: "직장인",
  preferences: [],
  annualMileage: 20_000,
  returnType: "반납형",
  fuelPreference: "하이브리드",
  residenceRegion: "일반",
};

describe("recommend engine selector", () => {
  it("calls only overlap-v2 when the global selector is v2", async () => {
    const legacy = vi.fn(async () => []);
    const overlap = vi.fn(async () => []);
    await recommendWithEngines(input, { version: () => "overlap-v2", legacy, overlap });
    expect(overlap).toHaveBeenCalledOnce();
    expect(legacy).not.toHaveBeenCalled();
  });

  it("calls only legacy-v1 during readiness and rollback", async () => {
    const legacy = vi.fn(async () => []);
    const overlap = vi.fn(async () => []);
    await recommendWithEngines(input, { version: () => "legacy-v1", legacy, overlap });
    expect(legacy).toHaveBeenCalledOnce();
    expect(overlap).not.toHaveBeenCalled();
  });
});
