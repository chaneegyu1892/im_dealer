import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getActiveUser: vi.fn(),
  findVehicle: vi.fn(),
  findRateSheets: vi.fn(),
  findRankSurcharges: vi.fn(),
  findSavedQuote: vi.fn(),
  upsertSavedQuote: vi.fn(),
  updateCalcLogs: vi.fn(),
  transaction: vi.fn(),
  calculate: vi.fn(),
  createAdminNotification: vi.fn(),
  cookieGet: vi.fn(),
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
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/require-user", () => ({
  getActiveUser: mocks.getActiveUser,
}));

vi.mock("@/lib/quote-calculator", () => ({
  calculateMultiFinanceQuote: mocks.calculate,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

vi.mock("@/lib/admin-notification", () => ({
  createAdminNotification: mocks.createAdminNotification,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: mocks.cookieGet })),
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
    mocks.getActiveUser.mockResolvedValue(null);
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
        rules: [],
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
    mocks.transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations)
    );
    mocks.createAdminNotification.mockResolvedValue(undefined);
    mocks.cookieGet.mockReturnValue(undefined);
    mocks.calculate.mockReturnValue([{
      financeCompanyName: "테스트캐피탈",
      rank: 1,
      monthlyPayment: 650_000,
      baseMonthly: 640_000,
      breakdown: {},
      surcharges: {},
    }]);
  });

  it("uses a session-unique upsert and preserves exact member custom rates", async () => {
    mocks.getActiveUser.mockResolvedValue({
      id: "member-db-1",
      supabaseId: "member-1",
      name: "카카오회원",
      phone: "010-1234-5678",
    });

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
    expect(mocks.updateCalcLogs).toHaveBeenCalledWith({
      where: {
        sessionId: "session-1",
        vehicleSlug: "test-car",
      },
      data: { clickedApply: true },
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

  it("does not let a session ID alone update an unowned quote", async () => {
    mocks.findSavedQuote.mockResolvedValue({
      id: "quote-1",
      userId: null,
      deletedAt: null,
      status: "NEW",
      pricingStatus: "CALCULATED",
      customerName: null,
      phone: null,
      verificationCapabilityHash: "a".repeat(64),
    });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(mocks.upsertSavedQuote).not.toHaveBeenCalled();
  });

  it("issues an HttpOnly verification capability for a new anonymous quote", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.upsertSavedQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: null,
          verificationCapabilityHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      })
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    // /api/quote/save 재저장과 /api/verification/* 모두에서 읽어야 하므로 공통 상위 경로.
    expect(response.headers.get("set-cookie")).toContain("Path=/api;");
  });

  it("stores the linked member profile when the quote has no verified contact yet", async () => {
    mocks.getActiveUser.mockResolvedValue({
      id: "member-db-1",
      supabaseId: "member-1",
      name: "카카오회원",
      phone: "010-1234-5678",
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.upsertSavedQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "member-1",
          customerName: "카카오회원",
          phone: "010-1234-5678",
        }),
      })
    );
  });

  it("keeps verified quote contact ahead of the linked member profile", async () => {
    mocks.getActiveUser.mockResolvedValue({
      id: "member-db-1",
      supabaseId: "member-1",
      name: "카카오회원",
      phone: "010-1234-5678",
    });
    mocks.findSavedQuote.mockResolvedValue({
      id: "quote-1",
      userId: "member-1",
      deletedAt: null,
      status: "NEW",
      pricingStatus: "CALCULATED",
      customerName: "본인확인 이름",
      phone: "010-9999-9999",
    });
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.upsertSavedQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          customerName: "본인확인 이름",
          phone: "010-9999-9999",
        }),
      })
    );
  });

  it("ignores member-only custom rates when an anonymous session saves a quote", async () => {
    // 기본 request()는 비회원 + customDepositRate 10 — 공개 조건(선납 30%)으로 강제돼야 한다.
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.calculate.mock.calls[0]?.[0]).toMatchObject({
      depositRate: 0,
      prepayRate: 30,
    });
    expect(mocks.upsertSavedQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ depositRate: 0, prepayRate: 30 }),
      })
    );
  });

  it("forces anonymous deposit/prepay scenario saves back to the standard type with public prepay rates", async () => {
    const conservativeRequest = new NextRequest("https://example.com/api/quote/save", {
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
        scenarioType: "conservative",
        quoteType: "DETAIL",
      }),
    });

    const response = await POST(conservativeRequest);

    expect(response.status).toBe(200);
    expect(mocks.calculate.mock.calls[0]?.[0]).toMatchObject({
      depositRate: 0,
      prepayRate: 30,
    });
    const createData = mocks.upsertSavedQuote.mock.calls[0][0].create;
    expect(createData.depositRate).toBe(0);
    expect(createData.prepayRate).toBe(30);
    expect(createData.breakdown.scenarioType).toBe("standard");
  });

  it("stores per-scenario snapshots so reissued documents keep the original comparison amounts", async () => {
    mocks.calculate.mockImplementation((input: { depositRate: number; prepayRate: number }) => {
      const monthlyPayment =
        input.depositRate === 20 ? 610_000 : input.prepayRate === 30 ? 510_000 : 810_000;
      return [{
        financeCompanyName: "테스트캐피탈",
        rank: 1,
        monthlyPayment,
        baseMonthly: monthlyPayment,
        breakdown: {
          depositAmount: input.depositRate === 20 ? 8_000_000 : 0,
          prepayAmount: input.prepayRate === 30 ? 12_000_000 : 0,
        },
        surcharges: {},
      }];
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    const createData = mocks.upsertSavedQuote.mock.calls[0][0].create;
    expect(createData.breakdown.scenarioSnapshots).toEqual({
      conservative: {
        monthlyPayment: 610_000,
        depositAmount: 8_000_000,
        prepayAmount: 0,
        bestFinanceCompany: "테스트캐피탈",
        purchaseSurcharge: 0,
      },
      standard: {
        monthlyPayment: 810_000,
        depositAmount: 0,
        prepayAmount: 0,
        bestFinanceCompany: "테스트캐피탈",
        purchaseSurcharge: 0,
      },
      aggressive: {
        monthlyPayment: 510_000,
        depositAmount: 0,
        prepayAmount: 12_000_000,
        bestFinanceCompany: "테스트캐피탈",
        purchaseSurcharge: 0,
      },
    });
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
        rules: [],
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
    expect(mocks.updateCalcLogs).toHaveBeenCalledWith({
      where: {
        sessionId: "session-1",
        vehicleSlug: "test-car",
      },
      data: { clickedApply: true },
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

  it("returns the persisted monthly payment so the client can sync the on-screen amount", async () => {
    mocks.getActiveUser.mockResolvedValue({
      id: "member-db-1",
      supabaseId: "member-1",
      name: "카카오회원",
      phone: "010-1234-5678",
    });

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({
      id: "quote-1",
      sessionId: "session-1",
      requiresConsultation: false,
      monthlyPayment: 650_000,
      totalCost: 650_000 * 60,
      pricingStatus: "CALCULATED",
      depositRate: 10,
      prepayRate: 0,
    });
  });

  it("returns the stored amount without recalculating a quote that already left NEW", async () => {
    mocks.getActiveUser.mockResolvedValue({
      id: "member-db-1",
      supabaseId: "member-1",
      name: "카카오회원",
      phone: "010-1234-5678",
    });
    mocks.findSavedQuote.mockResolvedValue({
      id: "quote-1",
      userId: "member-1",
      deletedAt: null,
      status: "CONTACTED",
      pricingStatus: "CALCULATED",
      monthlyPayment: 612_000,
      totalCost: 36_720_000,
      depositRate: 10,
      prepayRate: 0,
      breakdown: {
        bestFinanceCompany: "저장캐피탈",
        quoteBreakdown: { depositAmount: 4_000_000, prepayAmount: 0 },
      },
      customerName: "본인확인 이름",
      phone: "010-9999-9999",
      verificationCapabilityHash: null,
    });

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.upsertSavedQuote).not.toHaveBeenCalled();
    expect(mocks.calculate).not.toHaveBeenCalled();
    expect(payload.data).toMatchObject({
      id: "quote-1",
      monthlyPayment: 612_000,
      totalCost: 36_720_000,
      depositAmount: 4_000_000,
      bestFinanceCompany: "저장캐피탈",
    });
  });

  it("does not re-validate options when returning an already-progressed quote", async () => {
    mocks.getActiveUser.mockResolvedValue({
      id: "member-db-1",
      supabaseId: "member-1",
      name: "카카오회원",
      phone: "010-1234-5678",
    });
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
        options: [
          { id: "opt-a", name: "선루프", price: 1_000_000 },
          { id: "opt-b", name: "파노라마", price: 2_000_000 },
        ],
        rules: [{
          ruleType: "CONFLICT",
          sourceOptionId: "opt-a",
          targetOptionId: "opt-b",
        }],
      }],
      colors: [],
    });
    mocks.findSavedQuote.mockResolvedValue({
      id: "quote-1",
      userId: "member-1",
      deletedAt: null,
      status: "CONTACTED",
      pricingStatus: "CALCULATED",
      monthlyPayment: 612_000,
      totalCost: 36_720_000,
      depositRate: 10,
      prepayRate: 0,
      breakdown: {
        bestFinanceCompany: "저장캐피탈",
        quoteBreakdown: { depositAmount: 4_000_000, prepayAmount: 0 },
      },
      customerName: "본인확인 이름",
      phone: "010-9999-9999",
      verificationCapabilityHash: null,
    });

    const conflictRequest = new NextRequest("https://example.com/api/quote/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        vehicleSlug: "test-car",
        trimId: "trim-1",
        selectedOptionIds: ["opt-a", "opt-b"],
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        customerType: "individual",
        productType: "장기렌트",
        scenarioType: "standard",
        quoteType: "DETAIL",
      }),
    });

    const response = await POST(conflictRequest);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.monthlyPayment).toBe(612_000);
    expect(mocks.upsertSavedQuote).not.toHaveBeenCalled();
  });

  it("includes REQUIRED/INCLUDED options in the saved vehicle price", async () => {
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
        discountPrice: 38_000_000,
        options: [
          { id: "opt-source", name: "패키지", price: 1_000_000 },
          { id: "opt-included", name: "포함 옵션", price: 500_000 },
        ],
        rules: [{
          ruleType: "INCLUDED",
          sourceOptionId: "opt-source",
          targetOptionId: "opt-included",
        }],
      }],
      colors: [],
    });

    const includedRequest = new NextRequest("https://example.com/api/quote/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        vehicleSlug: "test-car",
        trimId: "trim-1",
        selectedOptionIds: ["opt-source"],
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        customerType: "individual",
        productType: "장기렌트",
        scenarioType: "standard",
        quoteType: "DETAIL",
      }),
    });

    const response = await POST(includedRequest);

    expect(response.status).toBe(200);
    expect(mocks.calculate.mock.calls[0]?.[0]).toMatchObject({
      vehiclePrice: 38_000_000 + 1_000_000 + 500_000,
    });
    const createData = mocks.upsertSavedQuote.mock.calls[0][0].create;
    expect(createData.breakdown.selectedOptions).toEqual([
      { id: "opt-source", name: "패키지", price: 1_000_000 },
      { id: "opt-included", name: "포함 옵션", price: 500_000 },
    ]);
    expect(createData.breakdown.discountPrice).toBe(38_000_000);
    expect(createData.breakdown.trimPrice).toBe(40_000_000);
  });

  it("rejects conflicting option combinations before saving", async () => {
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
        options: [
          { id: "opt-a", name: "선루프", price: 1_000_000 },
          { id: "opt-b", name: "파노라마", price: 2_000_000 },
        ],
        rules: [{
          ruleType: "CONFLICT",
          sourceOptionId: "opt-a",
          targetOptionId: "opt-b",
        }],
      }],
      colors: [],
    });

    const conflictRequest = new NextRequest("https://example.com/api/quote/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "session-1",
        vehicleSlug: "test-car",
        trimId: "trim-1",
        selectedOptionIds: ["opt-a", "opt-b"],
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        customerType: "individual",
        productType: "장기렌트",
        scenarioType: "standard",
        quoteType: "DETAIL",
      }),
    });

    const response = await POST(conflictRequest);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("함께 선택할 수 없는 옵션 조합입니다");
    expect(payload.error).toContain("선루프 ↔ 파노라마");
    expect(mocks.upsertSavedQuote).not.toHaveBeenCalled();
    expect(mocks.calculate).not.toHaveBeenCalled();
  });
});

