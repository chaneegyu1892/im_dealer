import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findVehicle: vi.fn(),
  findRateSheets: vi.fn(),
  findRankSurcharges: vi.fn(),
  findSavedQuote: vi.fn(),
  upsertSavedQuote: vi.fn(),
  updateCalcLogs: vi.fn(),
  calculate: vi.fn(),
  createAdminNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: mocks.findVehicle },
    capitalRateSheet: { findMany: mocks.findRateSheets },
    rankSurchargeConfig: { findMany: mocks.findRankSurcharges },
    savedQuote: {
      findUnique: mocks.findSavedQuote,
      upsert: mocks.upsertSavedQuote,
    },
    quoteCalcLog: { updateMany: mocks.updateCalcLogs },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock("@/lib/quote-calculator", () => ({
  calculateMultiFinanceQuote: mocks.calculate,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/admin-notification", () => ({
  createAdminNotification: mocks.createAdminNotification,
}));

function request(): NextRequest {
  return new NextRequest("https://example.com/api/quote/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-1",
      vehicleSlug: "test-car",
      trimId: "trim-1",
      selectedOptionIds: [],
      contractMonths: 60,
      annualMileage: 20000,
      contractType: "반납형",
      customerType: "individual",
      productType: "장기렌트",
      scenarioType: "standard",
      customDepositRate: 10,
      customPrepayRate: 0,
      quoteType: "AI",
    }),
  });
}

describe("POST /api/quote/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.findVehicle.mockResolvedValue({
      id: "vehicle-1",
      slug: "test-car",
      name: "테스트 차량",
      brand: "테스트",
      surchargeRate: 0,
      isVisible: true,
      trims: [{
        id: "trim-1",
        name: "기본 트림",
        price: 40_000_000,
        discountPrice: null,
        options: [],
      }],
      colors: [],
    });
    mocks.findRateSheets.mockResolvedValue([{
      financeCompanyId: "finance-1",
      minVehiclePrice: 30_000_000,
      maxVehiclePrice: 50_000_000,
      minRateMatrix: {},
      maxRateMatrix: {},
      depositDiscountRate: -0.000523,
      prepayAdjustRate: 0.000073,
      financeCompany: { name: "테스트캐피탈", surchargeRate: 0 },
    }]);
    mocks.findRankSurcharges.mockResolvedValue([]);
    mocks.findSavedQuote.mockResolvedValue(null);
    mocks.upsertSavedQuote.mockResolvedValue({ id: "quote-1", sessionId: "session-1" });
    mocks.updateCalcLogs.mockResolvedValue({ count: 1 });
    mocks.createAdminNotification.mockResolvedValue(undefined);
    mocks.calculate.mockReturnValue([{
      financeCompanyName: "테스트캐피탈",
      rank: 1,
      monthlyPayment: 650_000,
      baseMonthly: 640_000,
      breakdown: {},
      surcharges: {},
    }]);
  });

  it("uses a session-unique upsert and preserves exact custom rates", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.upsertSavedQuote).toHaveBeenCalledWith({
      where: { sessionId: "session-1" },
      create: expect.objectContaining({
        sessionId: "session-1",
        depositRate: 10,
        prepayRate: 0,
        quoteType: "AI",
        pricingStatus: "CALCULATED",
      }),
      update: {},
    });
  });

  it("does not let an anonymous request overwrite an owned quote", async () => {
    mocks.findSavedQuote.mockResolvedValue({
      id: "quote-1",
      userId: "user-1",
      deletedAt: null,
      status: "NEW",
      pricingStatus: "CALCULATED",
    });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.upsertSavedQuote).not.toHaveBeenCalled();
  });

  it("persists the full selected configuration when rate data is unavailable", async () => {
    mocks.findVehicle.mockResolvedValue({
      id: "vehicle-1",
      slug: "test-car",
      name: "테스트 차량",
      brand: "테스트",
      surchargeRate: 0,
      isVisible: true,
      trims: [{
        id: "trim-1",
        name: "기본 트림",
        price: 40_000_000,
        discountPrice: null,
        options: [{ id: "option-1", name: "파노라마 선루프", price: 1_000_000 }],
      }],
      colors: [{
        id: "color-1",
        kind: "EXTERIOR",
        name: "화이트",
        hexCode: "#ffffff",
        priceDelta: 100_000,
      }],
    });
    mocks.findRateSheets.mockResolvedValue([]);

    const consultationRequest = new NextRequest("https://example.com/api/quote/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        vehicleSlug: "test-car",
        trimId: "trim-1",
        selectedOptionIds: ["option-1"],
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        customerType: "individual",
        productType: "리스",
        scenarioType: "standard",
        exteriorColorId: "color-1",
        quoteType: "DETAIL",
      }),
    });

    const response = await POST(consultationRequest);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      id: "quote-1",
      sessionId: "session-1",
      requiresConsultation: true,
    });
    expect(mocks.upsertSavedQuote).toHaveBeenCalledWith({
      where: { sessionId: "session-1" },
      create: expect.objectContaining({
        trimId: "trim-1",
        annualMileage: 20000,
        contractMonths: 60,
        exteriorColorId: "color-1",
        monthlyPayment: 0,
        pricingStatus: "CONSULTATION_REQUIRED",
      }),
      update: {},
    });
    const createData = mocks.upsertSavedQuote.mock.calls[0][0].create;
    expect(createData.breakdown).toMatchObject({
      productType: "리스",
      trimName: "기본 트림",
      selectedOptions: [{ id: "option-1", name: "파노라마 선루프", price: 1_000_000 }],
      exteriorColor: expect.objectContaining({ name: "화이트" }),
      requiresConsultation: true,
      consultationReason: "RATE_SHEET_UNAVAILABLE",
    });
    expect(mocks.createAdminNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "별도 상담 견적 요청",
        linkUrl: "/admin/quotations?id=quote-1",
      })
    );
    expect(mocks.calculate).not.toHaveBeenCalled();
  });
});
