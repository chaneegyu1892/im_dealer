import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findVehicle: vi.fn(),
  findRateSheets: vi.fn(),
  findRankSurcharges: vi.fn(),
  calculate: vi.fn(),
  getUser: vi.fn(),
  upsertLogs: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: mocks.findVehicle },
    capitalRateSheet: { findMany: mocks.findRateSheets },
    rankSurchargeConfig: { findMany: mocks.findRankSurcharges },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock("@/lib/quote-calculator", () => ({
  calculateMultiFinanceQuote: mocks.calculate,
}));

vi.mock("@/lib/quote-calc-log", () => ({
  upsertQuoteCalcLogs: mocks.upsertLogs,
}));

vi.mock("@/lib/ip-hash", () => ({
  getClientIp: () => "127.0.0.1",
  hashIp: () => "hashed-ip",
}));

vi.mock("@/lib/rate-limit", () => ({
  apiRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { POST } from "./route";

function request() {
  return new NextRequest("https://example.com/api/quote/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-1",
      vehicleSlug: "test-car",
      trimId: "trim-1",
      selectedOptionIds: ["option-1"],
      contractMonths: 60,
      annualMileage: 20_000,
      contractType: "반납형",
      productType: "장기렌트",
      customerType: "individual",
    }),
  });
}

describe("POST /api/quote/calculate log persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "member-1" } } });
    mocks.findVehicle.mockResolvedValue({
      id: "vehicle-1",
      slug: "test-car",
      name: "테스트 차량",
      brand: "테스트",
      isVisible: true,
      surchargeRate: 0,
      trims: [
        {
          id: "trim-1",
          name: "기본 트림",
          price: 40_000_000,
          discountPrice: 39_000_000,
          isDefault: true,
          options: [{ id: "option-1", name: "선루프", price: 1_000_000 }],
        },
      ],
      colors: [],
    });
    mocks.findRateSheets.mockResolvedValue([
      {
        financeCompanyId: "finance-1",
        minVehiclePrice: 30_000_000,
        maxVehiclePrice: 50_000_000,
        minRateMatrix: {},
        maxRateMatrix: {},
        depositDiscountRate: -0.000523,
        prepayAdjustRate: 0.000073,
        financeCompany: {
          name: "테스트캐피탈",
          surchargeRate: 0,
        },
      },
    ]);
    mocks.findRankSurcharges.mockResolvedValue([]);
    mocks.calculate.mockReturnValue([
      {
        financeCompanyName: "테스트캐피탈",
        rank: 1,
        monthlyPayment: 650_000,
        baseMonthly: 640_000,
        breakdown: { depositAmount: 0, prepayAmount: 0 },
        surcharges: {},
        rangeExceeded: false,
      },
    ]);
  });

  it("does not finish the response before all scenario logs are stored", async () => {
    let releaseLogs: (() => void) | undefined;
    mocks.upsertLogs.mockImplementation(
      () => new Promise<void>((resolve) => {
        releaseLogs = resolve;
      })
    );

    let completed = false;
    const pending = POST(request()).then((response) => {
      completed = true;
      return response;
    });

    await vi.waitFor(() => expect(mocks.upsertLogs).toHaveBeenCalledOnce());
    expect(completed).toBe(false);
    expect(mocks.upsertLogs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: "session-1",
          userId: "member-1",
          vehicleName: "테스트 차량",
          trimName: "기본 트림",
          optionSnapshots: [{ id: "option-1", name: "선루프", price: 1_000_000 }],
          pricingStatus: "CALCULATED",
        }),
      ])
    );

    releaseLogs?.();
    const response = await pending;
    expect(response.status).toBe(200);
    expect(completed).toBe(true);
  });

  it("stores result views that require a separate consultation", async () => {
    mocks.findRateSheets.mockResolvedValue([]);
    mocks.upsertLogs.mockResolvedValue(undefined);

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.requiresConsultation).toBe(true);
    expect(mocks.upsertLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        sessionId: "session-1",
        resultMonthly: 0,
        pricingStatus: "CONSULTATION_REQUIRED",
        scenarioType: "standard",
      }),
    ]);
  });
});
