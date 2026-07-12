import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findManyVehicles: vi.fn(),
  recommendLegacyV1: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recommendationLog: { findFirst: mocks.findFirst },
    vehicle: { findMany: mocks.findManyVehicles },
  },
}));
vi.mock("@/lib/ai-recommender", () => ({ recommendLegacyV1: mocks.recommendLegacyV1 }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

import { GET } from "./route";

const baseLog = {
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

describe("GET /api/recommend/:sessionId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.recommendLegacyV1.mockResolvedValue([]);
    mocks.findManyVehicles.mockResolvedValue([]);
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
});
