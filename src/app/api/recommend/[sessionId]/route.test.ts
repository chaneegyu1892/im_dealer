import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findManyVehicles: vi.fn(),
  queryRaw: vi.fn(),
  recommendLegacyV1: vi.fn(),
  getActiveUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recommendationLog: { findFirst: mocks.findFirst },
    vehicle: { findMany: mocks.findManyVehicles },
    $queryRaw: mocks.queryRaw,
  },
}));
vi.mock("@/lib/ai-recommender", () => ({ recommendLegacyV1: mocks.recommendLegacyV1 }));
vi.mock("@/lib/require-user", () => ({
  getActiveUser: mocks.getActiveUser,
}));

import { GET } from "./route";

const baseLog = {
  id: "log-fixed",
  industry: "개인",
  industryDetail: "2~3명",
  purpose: "안정감, 가족",
  preferences: ["안정감", "가족"],
  childDetail: "미취학",
  cargoDetail: null,
  budgetMin: 0,
  budgetMax: 0,
  paymentStyle: "표준형",
  annualMileage: 20_000,
  returnType: "미정",
  purposeDetail: null,
  budgetDetail: null,
  fuelPreference: "하이브리드",
  chargingEnvironment: null,
  residenceRegion: "일반",
  recommendedReason: null,
  result: null,
};

const request = new NextRequest("http://localhost/api/recommend/session-fixed");
const context = { params: Promise.resolve({ sessionId: "session-fixed" }) };

const frozenVehicle = {
  vehicleId: "vehicle-active",
  rank: 1,
  score: 1,
  scoringVersion: "overlap-v2",
  documentScore: 1,
  chargingAdjustment: 0,
  rankScore: 1,
  contributions: [],
  tieBreak: {
    modelYear: 2026,
    companyPriority: 1,
    isPopular: false,
    profitPriority: 1,
    slug: "active-car",
  },
  reason: "저장된 추천 이유",
  highlights: ["저장된 특징"],
  estimatedMonthly: 500_000,
  vehicle: {
    name: "활성 차량",
    brand: "테스트",
    category: "SUV",
    thumbnailUrl: "https://cdn.example/old-cover.jpg",
    imageUrls: [],
    defaultTrimName: "기본",
    defaultTrimPrice: 40_000_000,
    slug: "active-car",
    popularConfigs: [],
  },
  scenarios: {
    conservative: { monthlyPayment: 500_000, depositAmount: 0, prepayAmount: 0, contractMonths: 60, annualMileage: 20_000, contractType: "반납형" },
    standard: { monthlyPayment: 500_000, depositAmount: 0, prepayAmount: 0, contractMonths: 60, annualMileage: 20_000, contractType: "반납형" },
    aggressive: { monthlyPayment: 500_000, depositAmount: 0, prepayAmount: 0, contractMonths: 60, annualMileage: 20_000, contractType: "반납형" },
  },
} as const;

const frozenV3Vehicle = {
  ...frozenVehicle,
  score: 8,
  scoringVersion: "step02-v3",
  stylePreference: "family-leisure",
  styleScore: 5,
  followupBonus: 3,
  autoConditionScore: 0,
  rankScore: 8,
  tieBreak: {
    modelYear: 2027,
    companyPriority: 1,
    immediateDeliveryAvailable: true,
    availableStockCount: 2,
    profitPriority: 1,
    slug: "active-car",
  },
} as const;

describe("GET /api/recommend/:sessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveUser.mockResolvedValue(null);
    mocks.recommendLegacyV1.mockResolvedValue([]);
    mocks.findManyVehicles.mockResolvedValue([]);
    mocks.queryRaw.mockResolvedValue([{ isSqlNull: true }]);
  });

  it("keeps an empty v2 envelope frozen without invoking either recommender", async () => {
    mocks.findFirst.mockResolvedValue({ ...baseLog, result: { version: "overlap-v2", vehicles: [] } });
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect((await response.json()).vehicles).toEqual([]);
    expect(mocks.recommendLegacyV1).not.toHaveBeenCalled();
    expect(mocks.findManyVehicles).not.toHaveBeenCalled();
  });

  it("keeps a historical empty legacy array frozen", async () => {
    mocks.findFirst.mockResolvedValue({ ...baseLog, result: [] });
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(mocks.recommendLegacyV1).not.toHaveBeenCalled();
  });

  it("replays a STEP 02 v3 result and reconstructs its style selection", async () => {
    mocks.findFirst.mockResolvedValue({
      ...baseLog,
      budgetMin: 1_000_000,
      budgetMax: 0,
      purpose: "family-leisure, 가족",
      preferences: ["family-leisure", "가족"],
      result: { version: "step02-v3", vehicles: [frozenV3Vehicle] },
    });
    mocks.findManyVehicles.mockResolvedValue([{ id: "vehicle-active" }]);
    const response = await GET(request, context);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.input.stylePreference).toBe("family-leisure");
    expect(body.input.budgetRange).toBe("gte-1000k");
    expect(body.input).toMatchObject({ budgetMin: 1_000_000, budgetMax: 0 });
    expect(body.vehicles[0]).toMatchObject({
      scoringVersion: "step02-v3",
      rankScore: 8,
    });
    expect(mocks.recommendLegacyV1).not.toHaveBeenCalled();
  });

  // 예산 때문에 결과가 비었을 때 "조금만 더 쓰면 가능한 차량"을 보여주려면
  // 프리즈된 근접 후보를 그대로 내려줘야 한다.
  it("returns the frozen near miss list for an empty v3 result", async () => {
    const nearMiss = { ...frozenV3Vehicle, vehicleId: "vehicle-active", estimatedMonthly: 1_100_000 };
    mocks.findFirst.mockResolvedValue({
      ...baseLog,
      preferences: ["family-leisure", "가족"],
      result: { version: "step02-v3", vehicles: [], nearMissVehicles: [nearMiss] },
    });
    mocks.findManyVehicles.mockResolvedValue([{ id: "vehicle-active" }]);

    const body = await (await GET(request, context)).json();
    expect(body.vehicles).toEqual([]);
    expect(body.nearMissVehicles).toHaveLength(1);
    expect(body.nearMissVehicles[0]).toMatchObject({ estimatedMonthly: 1_100_000 });
    expect(mocks.recommendLegacyV1).not.toHaveBeenCalled();
  });

  it("drops a near miss vehicle that is no longer visible", async () => {
    const nearMiss = { ...frozenV3Vehicle, vehicleId: "vehicle-gone" };
    mocks.findFirst.mockResolvedValue({
      ...baseLog,
      preferences: ["family-leisure", "가족"],
      result: { version: "step02-v3", vehicles: [], nearMissVehicles: [nearMiss] },
    });
    mocks.findManyVehicles.mockResolvedValue([]);

    const body = await (await GET(request, context)).json();
    expect(body.nearMissVehicles).toEqual([]);
  });

  it("reports an empty near miss list for envelopes that predate it", async () => {
    mocks.findFirst.mockResolvedValue({
      ...baseLog,
      preferences: ["family-leisure", "가족"],
      result: { version: "step02-v3", vehicles: [frozenV3Vehicle] },
    });
    mocks.findManyVehicles.mockResolvedValue([{ id: "vehicle-active" }]);

    const body = await (await GET(request, context)).json();
    expect(body.vehicles).toHaveLength(1);
    expect(body.nearMissVehicles).toEqual([]);
  });

  it("returns historical recommendation bytes without replacing its representative projection", async () => {
    const result = { version: "overlap-v2", vehicles: [frozenVehicle] } as const;
    const storedBytes = JSON.stringify(result);
    mocks.getActiveUser.mockResolvedValue({ id: "member-db-1", supabaseId: "member", isActive: true });
    mocks.findFirst.mockResolvedValue({ ...baseLog, result });
    mocks.findManyVehicles.mockResolvedValue([{
      id: "vehicle-active",
      thumbnailUrl: "https://cdn.example/new-cover.jpg",
    }]);

    const response = await GET(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.vehicles).toEqual([frozenVehicle]);
    expect(JSON.stringify(result)).toBe(storedBytes);
    expect(body.vehicles[0].vehicle.thumbnailUrl).toBe("https://cdn.example/old-cover.jpg");
    expect(mocks.recommendLegacyV1).not.toHaveBeenCalled();
  });

  it("replays frozen popularity evidence without recalculation", async () => {
    const popularity = {
      period: "2026-05",
      rank: 2,
      registrationCount: 7_086,
    } as const;
    const result = {
      version: "overlap-v2",
      vehicles: [{ ...frozenVehicle, popularity }],
    } as const;
    mocks.getActiveUser.mockResolvedValue({ id: "member-db-1", supabaseId: "member", isActive: true });
    mocks.findFirst.mockResolvedValue({ ...baseLog, result });
    mocks.findManyVehicles.mockResolvedValue([{ id: "vehicle-active" }]);

    const response = await GET(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.vehicles[0]?.popularity).toEqual(popularity);
    expect(mocks.recommendLegacyV1).not.toHaveBeenCalled();
  });

  it("fails closed for invalid non-null storage", async () => {
    mocks.findFirst.mockResolvedValue({ ...baseLog, result: { vehicles: [] } });
    const response = await GET(request, context);
    expect(response.status).toBe(500);
    expect(mocks.recommendLegacyV1).not.toHaveBeenCalled();
  });

  it("uses legacy-v1 exactly once only for an actual SQL NULL result", async () => {
    mocks.findFirst.mockResolvedValue(baseLog);
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(mocks.recommendLegacyV1).toHaveBeenCalledOnce();
    expect(mocks.recommendLegacyV1).toHaveBeenCalledWith(expect.objectContaining({
      primaryPreference: "안정감",
      situationPreference: "가족",
      childDetail: "미취학",
      fuelPreference: "하이브리드",
      residenceRegion: "일반",
    }));
    const body = await response.json();
    expect(body.input).toEqual(expect.objectContaining({
      industryDetail: "2~3명",
      primaryPreference: "안정감",
      situationPreference: "가족",
      childDetail: "미취학",
      fuelPreference: "하이브리드",
      residenceRegion: "일반",
    }));
  });

  it("fails closed for a JSON null result", async () => {
    mocks.findFirst.mockResolvedValue(baseLog);
    mocks.queryRaw.mockResolvedValue([{ isSqlNull: false }]);
    const response = await GET(request, context);
    expect(response.status).toBe(500);
    expect(mocks.recommendLegacyV1).not.toHaveBeenCalled();
  });
});
