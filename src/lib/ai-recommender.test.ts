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

  it("calls only step02-v3 for an explicitly versioned new request", async () => {
    const legacy = vi.fn(async () => []);
    const overlap = vi.fn(async () => []);
    const step02 = vi.fn(async () => ({ vehicles: [], nearMissVehicles: [] }));
    await recommendWithEngines(
      { ...input, recommendationVersion: "step02-v3", stylePreference: "auto" },
      { version: () => "step02-v3", legacy, overlap, step02 }
    );
    expect(step02).toHaveBeenCalledOnce();
    expect(legacy).not.toHaveBeenCalled();
    expect(overlap).not.toHaveBeenCalled();
  });

  // 근접 후보는 step02-v3 에만 있는 개념이라 옛 엔진은 빈 목록으로 맞춘다.
  it("carries the step02-v3 near miss list through the selector", async () => {
    const nearMiss = [{ vehicleId: "veh_near" }] as never;
    const run = await recommendWithEngines(
      { ...input, recommendationVersion: "step02-v3", stylePreference: "auto" },
      {
        version: () => "step02-v3",
        legacy: vi.fn(async () => []),
        overlap: vi.fn(async () => []),
        step02: vi.fn(async () => ({ vehicles: [], nearMissVehicles: nearMiss })),
      }
    );
    expect(run).toEqual({ vehicles: [], nearMissVehicles: nearMiss });
  });

  it.each(["legacy-v1", "overlap-v2"] as const)(
    "%s reports an empty near miss list",
    async (version) => {
      const run = await recommendWithEngines(input, {
        version: () => version,
        legacy: vi.fn(async () => []),
        overlap: vi.fn(async () => []),
      });
      expect(run).toEqual({ vehicles: [], nearMissVehicles: [] });
    }
  );
});
