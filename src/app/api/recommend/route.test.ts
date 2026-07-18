import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { compileOverlapCatalog } from "@/lib/recommend/overlap-catalog";
import type { OverlapCandidateSnapshot } from "@/lib/recommend/overlap-candidate-loader";
import { recommendOverlapV2FromSnapshot } from "@/lib/recommend/recommend-overlap-v2";
import type { RecommendInput } from "@/types/recommendation";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  recommendForVersion: vi.fn(),
  version: { value: "overlap-v2" },
  projection: { value: "https://cdn.example/old-cover.jpg" },
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
  budgetMax: 1_000_000,
};

const rateMatrix = {
  "36_10000": 0.02,
  "36_20000": 0.02,
  "36_30000": 0.02,
  "48_10000": 0.02,
  "48_20000": 0.02,
  "48_30000": 0.02,
  "60_10000": 0.02,
  "60_20000": 0.02,
  "60_30000": 0.02,
} as const;

function projectionSnapshot(thumbnailUrl: string): OverlapCandidateSnapshot {
  const catalog = compileOverlapCatalog().find((candidate) => candidate.documentName === "더 뉴 카니발 HEV");
  if (!catalog) throw new TypeError("missing recommendation projection fixture");
  return {
    rankSurchargeRates: [1, 1.5, 2, 2.5],
    vehicles: [{
      vehicleId: "vehicle-1",
      slug: "kia-carnival-hev",
      brand: "기아",
      name: "더 뉴 카니발 HEV",
      category: "RV",
      isVisible: true,
      surchargeRate: 0,
      isPopular: true,
      thumbnailUrl,
      imageUrls: ["https://cdn.example/gallery.jpg"],
      highlights: ["패밀리", "하이브리드"],
      popularConfigs: [{
        id: "config-1",
        name: "인기 구성",
        note: "동일 구성",
        items: [{ id: "item-1", name: "옵션", price: 1_000_000, trimOptionId: null }],
      }],
      config: { isActive: true, profile: catalog.profile },
      trims: [{
        id: "trim-1",
        name: "2027년형 기본",
        price: 40_000_000,
        discountPrice: null,
        isDefault: true,
        isVisible: true,
        lineup: { name: "2027년형", isVisible: true },
        rateSheets: [{
          id: "rate-1",
          productType: "장기렌트",
          isActive: true,
          minVehiclePrice: 30_000_000,
          maxVehiclePrice: 50_000_000,
          minRateMatrix: rateMatrix,
          maxRateMatrix: rateMatrix,
          depositDiscountRate: -0.000523,
          prepayAdjustRate: 0.000073,
          financeCompany: {
            id: "finance-1",
            name: "테스트캐피탈",
            isActive: true,
            surchargeRate: 0,
          },
        }],
      }],
    }],
  };
}

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
    mocks.projection.value = "https://cdn.example/old-cover.jpg";
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
    expect(mocks.create.mock.calls[0]?.[0].data).toMatchObject({ budgetMin: 0, budgetMax: 1_000_000 });
  });

  it("keeps legacy mode frozen as the historical array shape", async () => {
    mocks.version.value = "legacy-v1";
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(mocks.recommendForVersion).toHaveBeenCalledWith(expect.any(Object), "legacy-v1");
    expect(mocks.create.mock.calls[0]?.[0].data.result).toEqual([]);
  });

  it("freezes each new recommendation with the representative projected at generation time", async () => {
    mocks.recommendForVersion.mockImplementation(async (input: RecommendInput) => [
      ...recommendOverlapV2FromSnapshot(input, projectionSnapshot(mocks.projection.value)).vehicles,
    ]);

    await POST(request(valid));
    const oldSnapshotBytes = JSON.stringify(mocks.create.mock.calls[0]?.[0].data.result);

    mocks.projection.value = "https://cdn.example/new-cover.jpg";
    await POST(request(valid));

    const oldStored = mocks.create.mock.calls[0]?.[0].data.result;
    const newStored = mocks.create.mock.calls[1]?.[0].data.result;
    expect(JSON.stringify(mocks.create.mock.calls[0]?.[0].data.result)).toBe(oldSnapshotBytes);
    expect(oldStored).toMatchObject({
      vehicles: [{
        rank: 1,
        score: expect.any(Number),
        contributions: expect.any(Array),
        reason: expect.any(String),
        scenarios: {
          conservative: expect.any(Object),
          standard: expect.any(Object),
          aggressive: expect.any(Object),
        },
        vehicle: {
          thumbnailUrl: "https://cdn.example/old-cover.jpg",
          name: expect.any(String),
          brand: expect.any(String),
          slug: expect.any(String),
        },
      }],
    });
    expect(newStored).toMatchObject({
      vehicles: [{ vehicle: { thumbnailUrl: "https://cdn.example/new-cover.jpg" } }],
    });
    expect(JSON.stringify(newStored).replaceAll("https://cdn.example/new-cover.jpg", "<thumbnail>"))
      .toBe(oldSnapshotBytes.replaceAll("https://cdn.example/old-cover.jpg", "<thumbnail>"));
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
