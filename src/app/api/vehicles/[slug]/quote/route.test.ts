import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const prismaMock = vi.hoisted(() => ({
  vehicle: {
    findUnique: vi.fn(),
  },
  capitalRateSheet: {
    findMany: vi.fn(),
  },
  rankSurchargeConfig: {
    findMany: vi.fn(),
  },
}));

const getActiveUserMock = vi.hoisted(() => vi.fn());
const upsertQuoteCalcLogMock = vi.hoisted(() => vi.fn());
const calculateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/quote-calculator", () => ({
  calculateMultiFinanceQuote: calculateMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/require-user", () => ({
  getActiveUser: getActiveUserMock,
}));

vi.mock("@/lib/ip-hash", () => ({
  getClientIp: () => "127.0.0.1",
  hashIp: () => "hashed-ip",
}));

vi.mock("@/lib/quote-calc-log", () => ({
  upsertQuoteCalcLog: upsertQuoteCalcLogMock,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

function quoteRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("https://example.com/api/vehicles/preparing-car/quote", {
    method: "POST",
    body: JSON.stringify({
      contractMonths: 60,
      annualMileage: 20000,
      contractType: "반납형",
      productType: "장기렌트",
      customerType: "individual",
      selectedOptionIds: [],
      ...body,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getActiveUserMock.mockResolvedValue(null);
  upsertQuoteCalcLogMock.mockResolvedValue({ id: "calc-1" });
});

describe("POST /api/vehicles/[slug]/quote", () => {
  it("rejects deposit and prepayment being applied together", async () => {
    const response = await POST(
      quoteRequest({ customDepositRate: 10, customPrepayRate: 10 }),
      { params: Promise.resolve({ slug: "preparing-car" }) }
    );

    expect(response.status).toBe(400);
    expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
    expect(upsertQuoteCalcLogMock).not.toHaveBeenCalled();
  });

  it("returns consultation guidance when the vehicle has no visible trims", async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: "vehicle-preparing",
      name: "준비중 차량",
      slug: "preparing-car",
      basePrice: 40_000_000,
      surchargeRate: 0,
      isVisible: true,
      trims: [],
      colors: [],
    });

    const response = await POST(quoteRequest(), {
      params: Promise.resolve({ slug: "preparing-car" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      data: {
        vehicleSlug: "preparing-car",
        trimId: "",
        trimName: "",
        trimPrice: 40_000_000,
        totalVehiclePrice: 40_000_000,
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        customerType: "individual",
        scenarios: {},
        requiresConsultation: true,
      },
    });
  });

  it("stores a consultation-required calculation even when no trim is available", async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: "vehicle-preparing",
      name: "준비중 차량",
      brand: "테스트",
      slug: "preparing-car",
      basePrice: 40_000_000,
      surchargeRate: 0,
      isVisible: true,
      trims: [],
      colors: [],
    });

    const response = await POST(quoteRequest({ sessionId: "session-1" }), {
      params: Promise.resolve({ slug: "preparing-car" }),
    });

    expect(response.status).toBe(200);
    expect(upsertQuoteCalcLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        vehicleName: "준비중 차량",
        trimId: null,
        resultMonthly: 0,
        pricingStatus: "CONSULTATION_REQUIRED",
      })
    );
  });

  it("returns consultation guidance instead of a 0-won quote when no rate cell matches", async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: "vehicle-1",
      name: "테스트 차량",
      brand: "테스트",
      slug: "preparing-car",
      basePrice: 40_000_000,
      surchargeRate: 0,
      isVisible: true,
      trims: [{
        id: "trim-1",
        name: "기본 트림",
        isDefault: true,
        price: 40_000_000,
        discountPrice: null,
        options: [],
        rules: [],
      }],
      colors: [],
    });
    prismaMock.capitalRateSheet.findMany.mockResolvedValue([{
      financeCompanyId: "finance-1",
      minVehiclePrice: 30_000_000,
      maxVehiclePrice: 50_000_000,
      minRateMatrix: {},
      maxRateMatrix: {},
      depositDiscountRate: -0.000523,
      prepayAdjustRate: 0.000073,
      financeCompany: { name: "테스트캐피탈", surchargeRate: 0 },
    }]);
    prismaMock.rankSurchargeConfig.findMany.mockResolvedValue([]);
    // 시트는 있지만 요청 조건(개월·주행)의 회수율이 전부 무효 → 엔진이 빈 배열 반환.
    calculateMock.mockReturnValue([]);

    const response = await POST(
      quoteRequest({ sessionId: "session-1", trimId: "trim-1" }),
      { params: Promise.resolve({ slug: "preparing-car" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      requiresConsultation: true,
      scenarios: {},
    });
    expect(upsertQuoteCalcLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        resultMonthly: 0,
        pricingStatus: "CONSULTATION_REQUIRED",
      })
    );
  });

  it("requires an explicit trim instead of silently choosing the default", async () => {
    prismaMock.vehicle.findUnique.mockResolvedValue({
      id: "vehicle-preparing",
      name: "준비중 차량",
      slug: "preparing-car",
      basePrice: 40_000_000,
      surchargeRate: 0,
      isVisible: true,
      trims: [{
        id: "trim-default",
        name: "임의 선택되면 안 되는 트림",
        isDefault: true,
        price: 40_000_000,
        options: [],
        rules: [],
      }],
      colors: [],
    });

    const response = await POST(quoteRequest(), {
      params: Promise.resolve({ slug: "preparing-car" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "트림을 선택해 주세요." });
    expect(prismaMock.rankSurchargeConfig.findMany).not.toHaveBeenCalled();
  });
});
