import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  recommendForVersion: vi.fn(),
  version: { value: "overlap-v2" },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { recommendationLog: { create: mocks.create } } }));
vi.mock("@/lib/ai-recommender", () => ({ recommendForVersion: mocks.recommendForVersion }));
vi.mock("@/lib/recommend/recommend-engine-version", () => ({ getRecommendEngineVersion: () => mocks.version.value }));
vi.mock("@/lib/rate-limit", () => ({ strictRateLimit: {}, checkRateLimit: vi.fn(async () => null) }));

import { POST } from "./route";

const valid = {
  industry: "개인",
  industryDetail: "2~3명",
  preferences: ["가족", "안정감"],
  primaryPreference: "안정감",
  situationPreference: "가족",
  childDetail: "미취학",
  annualMileage: 20_000,
  fuelPreference: "하이브리드",
  residenceRegion: "일반",
  returnType: "미정",
};

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/recommend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.version.value = "overlap-v2";
    mocks.recommendForVersion.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ id: "log" });
  });

  it("stores even zero v2 vehicles in a versioned frozen envelope", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sessionId: expect.any(String), vehicles: [] });
    expect(mocks.recommendForVersion).toHaveBeenCalledOnce();
    expect(mocks.recommendForVersion.mock.calls[0]?.[0].preferences).toEqual(["안정감", "가족"]);
    expect(mocks.create.mock.calls[0]?.[0].data.result).toEqual({ version: "overlap-v2", vehicles: [] });
  });

  it("keeps legacy mode frozen as the historical array shape", async () => {
    mocks.version.value = "legacy-v1";
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(mocks.recommendForVersion).toHaveBeenCalledWith(expect.any(Object), "legacy-v1");
    expect(mocks.create.mock.calls[0]?.[0].data.result).toEqual([]);
  });

  it("returns 400 with field details and performs no recommendation or write", async () => {
    const response = await POST(request({ ...valid, childDetail: undefined }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.details.fieldErrors.childDetail).toBeDefined();
    expect(mocks.recommendForVersion).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
