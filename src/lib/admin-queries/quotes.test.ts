import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findQuotes: vi.fn(),
  countQuotes: vi.fn(),
  findVehicles: vi.fn(),
  findTrims: vi.fn(),
  findMembers: vi.fn(),
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
    mocks.findTrims.mockResolvedValue([{ id: "trim-1", name: "기본 트림" }]);
    mocks.findMembers.mockResolvedValue([
      { supabaseId: "member-1", name: "카카오회원", phone: "010-1234-5678" },
    ]);
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
});
