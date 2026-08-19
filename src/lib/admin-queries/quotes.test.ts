import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findQuotes: vi.fn(),
  countQuotes: vi.fn(),
  findVehicles: vi.fn(),
  findTrims: vi.fn(),
  findMembers: vi.fn(),
  findDeliveries: vi.fn(),
  findAlimtalks: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    savedQuote: {
      findMany: mocks.findQuotes,
      count: mocks.countQuotes,
    },
    vehicle: { findMany: mocks.findVehicles },
    trim: { findMany: mocks.findTrims },
    user: { findMany: mocks.findMembers },
    quoteDelivery: { findMany: mocks.findDeliveries },
    alimtalkMessage: { findMany: mocks.findAlimtalks },
  },
}));

import { getAdminQuotes } from "./quotes";

function quote(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-1",
    sessionId: "session-1",
    userId: "member-1",
    vehicleId: "vehicle-1",
    trimId: "trim-1",
    contractMonths: 60,
    annualMileage: 20_000,
    depositRate: 0,
    prepayRate: 0,
    contractType: "반납형",
    customerType: "individual",
    monthlyPayment: 650_000,
    totalCost: 39_000_000,
    pricingStatus: "CALCULATED",
    breakdown: { productType: "장기렌트", selectedOptions: [] },
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    customerName: null,
    phone: null,
    status: "NEW",
    internalMemo: null,
    quoteType: "DETAIL",
    exteriorColor: null,
    interiorColor: null,
    ...overrides,
  };
}

describe("getAdminQuotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findQuotes.mockResolvedValue([quote()]);
    mocks.countQuotes.mockResolvedValue(1);
    mocks.findVehicles.mockResolvedValue([
      { id: "vehicle-1", name: "테스트 차량", brand: "테스트" },
    ]);
    mocks.findTrims.mockResolvedValue([{
      id: "trim-1",
      name: "기본 트림",
      price: 99_000_000,
      discountPrice: 88_000_000,
    }]);
    mocks.findMembers.mockResolvedValue([
      { supabaseId: "member-1", name: "카카오회원", phone: "010-1234-5678" },
    ]);
    mocks.findDeliveries.mockResolvedValue([]);
    mocks.findAlimtalks.mockResolvedValue([]);
  });

  it("uses the linked member profile when a saved quote has no contact snapshot", async () => {
    const result = await getAdminQuotes();

    expect(mocks.findMembers).toHaveBeenCalledWith({
      where: { supabaseId: { in: ["member-1"] } },
      select: { supabaseId: true, name: true, phone: true },
    });
    expect(result.data[0]).toMatchObject({
      customerName: "카카오회원",
      phone: "010-1234-5678",
      userType: "Member",
    });
  });

  it("keeps verified quote contact ahead of the member profile", async () => {
    mocks.findQuotes.mockResolvedValue([
      quote({ customerName: "본인확인 이름", phone: "010-9999-9999" }),
    ]);

    const result = await getAdminQuotes();

    expect(result.data[0]).toMatchObject({
      customerName: "본인확인 이름",
      phone: "010-9999-9999",
    });
  });

  it("falls back to the current catalog price when the snapshot has no trim pricing", async () => {
    const result = await getAdminQuotes();

    expect(result.data[0]).toMatchObject({
      trimPrice: 99_000_000,
      discountPrice: 88_000_000,
    });
  });

  it("shows saved trim prices instead of the current catalog price", async () => {
    mocks.findQuotes.mockResolvedValue([
      quote({
        breakdown: {
          productType: "장기렌트",
          trimName: "저장 트림",
          trimPrice: 50_000_000,
          discountPrice: 45_000_000,
          selectedOptions: [],
        },
      }),
    ]);

    const result = await getAdminQuotes();

    expect(result.data[0]).toMatchObject({
      trimName: "저장 트림",
      trimPrice: 50_000_000,
      discountPrice: 45_000_000,
    });
  });

  it("derives a discounted trim price from the saved total for legacy quotes", async () => {
    mocks.findQuotes.mockResolvedValue([
      quote({
        breakdown: {
          productType: "장기렌트",
          trimPrice: 50_000_000,
          optionsTotalPrice: 1_000_000,
          colorDelta: 0,
          totalVehiclePrice: 46_000_000,
          selectedOptions: [],
        },
      }),
    ]);

    const result = await getAdminQuotes();

    expect(result.data[0]).toMatchObject({
      trimPrice: 50_000_000,
      discountPrice: 45_000_000,
    });
  });

  it("returns none when a quote has no QuoteDelivery (미전달과 구분)", async () => {
    const result = await getAdminQuotes();

    expect(mocks.findDeliveries).toHaveBeenCalledWith({
      where: { savedQuoteId: { in: ["quote-1"] } },
      orderBy: { createdAt: "desc" },
      select: {
        savedQuoteId: true,
        status: true,
        failReason: true,
        createdAt: true,
        sentAt: true,
      },
    });
    expect(result.data[0].delivery).toEqual({
      status: "NONE",
      failReason: null,
      createdAt: null,
      sentAt: null,
    });
    expect(result.data[0].alimtalk).toBeNull();
  });

  it("picks the latest QuoteDelivery per quote and maps SENT/PENDING/FAILED", async () => {
    mocks.findQuotes.mockResolvedValue([
      quote({ id: "quote-sent" }),
      quote({ id: "quote-pending" }),
      quote({ id: "quote-failed" }),
    ]);
    mocks.findDeliveries.mockResolvedValue([
      {
        savedQuoteId: "quote-sent",
        status: "SENT",
        failReason: null,
        createdAt: new Date("2026-08-19T09:00:00.000Z"),
        sentAt: new Date("2026-08-19T09:01:00.000Z"),
      },
      {
        savedQuoteId: "quote-sent",
        status: "FAILED",
        failReason: "old fail",
        createdAt: new Date("2026-08-19T08:00:00.000Z"),
        sentAt: null,
      },
      {
        savedQuoteId: "quote-pending",
        status: "PENDING",
        failReason: null,
        createdAt: new Date("2026-08-19T09:10:00.000Z"),
        sentAt: null,
      },
      {
        savedQuoteId: "quote-failed",
        status: "FAILED",
        failReason: "카카오톡 미가입",
        createdAt: new Date("2026-08-19T09:20:00.000Z"),
        sentAt: null,
      },
    ]);

    const result = await getAdminQuotes();
    const byId = Object.fromEntries(result.data.map((row) => [row.id, row]));

    expect(byId["quote-sent"].delivery).toEqual({
      status: "SENT",
      failReason: null,
      createdAt: "2026-08-19T09:00:00.000Z",
      sentAt: "2026-08-19T09:01:00.000Z",
    });
    expect(byId["quote-pending"].delivery.status).toBe("PENDING");
    expect(byId["quote-failed"].delivery).toMatchObject({
      status: "FAILED",
      failReason: "카카오톡 미가입",
    });
  });

  it("attaches the latest quote alimtalk result without selecting recipient/message", async () => {
    mocks.findAlimtalks.mockResolvedValue([
      {
        refId: "quote-1",
        status: "FAILED",
        failReason: "3019 톡 유저 아님",
        resultCode: "3019",
        templateKey: "QUOTE_DELIVERED",
        createdAt: new Date("2026-08-19T09:05:00.000Z"),
        resultAt: new Date("2026-08-19T09:06:00.000Z"),
      },
      {
        refId: "quote-1",
        status: "SENT",
        failReason: null,
        resultCode: "1000",
        templateKey: "QUOTE_DELIVERED",
        createdAt: new Date("2026-08-19T08:00:00.000Z"),
        resultAt: new Date("2026-08-19T08:01:00.000Z"),
      },
    ]);

    const result = await getAdminQuotes();

    expect(mocks.findAlimtalks).toHaveBeenCalledWith({
      where: { refType: "quote", refId: { in: ["quote-1"] } },
      orderBy: { createdAt: "desc" },
      select: {
        refId: true,
        status: true,
        failReason: true,
        resultCode: true,
        templateKey: true,
        createdAt: true,
        resultAt: true,
      },
    });
    const select = mocks.findAlimtalks.mock.calls[0][0].select as Record<string, unknown>;
    expect(Object.keys(select)).not.toContain("recipient");
    expect(Object.keys(select)).not.toContain("message");
    expect(result.data[0].alimtalk).toEqual({
      status: "FAILED",
      failReason: "3019 톡 유저 아님",
      resultCode: "3019",
      templateKey: "QUOTE_DELIVERED",
      createdAt: "2026-08-19T09:05:00.000Z",
      resultAt: "2026-08-19T09:06:00.000Z",
    });
  });

  it("does not query deliveries or alimtalks when the page has no quotes", async () => {
    mocks.findQuotes.mockResolvedValue([]);
    mocks.countQuotes.mockResolvedValue(0);

    const result = await getAdminQuotes();

    expect(result.data).toEqual([]);
    expect(mocks.findDeliveries).not.toHaveBeenCalled();
    expect(mocks.findAlimtalks).not.toHaveBeenCalled();
  });
});
