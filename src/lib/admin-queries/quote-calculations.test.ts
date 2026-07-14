import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCalculations: vi.fn(),
  countCalculations: vi.fn(),
  findTrims: vi.fn(),
  findMembers: vi.fn(),
  findOptions: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    quoteCalcLog: {
      findMany: mocks.findCalculations,
      count: mocks.countCalculations,
    },
    trim: { findMany: mocks.findTrims },
    trimOption: { findMany: mocks.findOptions },
    user: { findMany: mocks.findMembers },
  },
}));

import { getAdminQuoteCalculations } from "./quote-calculations";

describe("getAdminQuoteCalculations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findCalculations.mockResolvedValue([
      {
        id: "calc-1",
        sessionId: "session-1",
        userId: "member-1",
        vehicleId: "vehicle-1",
        vehicleSlug: "test-car",
        vehicleName: "테스트 차량",
        vehicleBrand: "테스트",
        trimId: "trim-1",
        trimName: "저장 당시 트림",
        trimPrice: 40_000_000,
        discountPrice: 39_000_000,
        optionIds: ["option-1", "option-2"],
        optionSnapshots: [
          { id: "option-1", name: "저장 당시 옵션", price: 1_000_000 },
        ],
        extraOptionsPrice: 200_000,
        optionsTotalPrice: 1_200_000,
        exteriorColorId: "color-1",
        exteriorColorName: "화이트",
        interiorColorId: null,
        interiorColorName: null,
        colorDelta: 100_000,
        totalVehiclePrice: 40_300_000,
        contractMonths: 60,
        annualMileage: 20_000,
        depositRate: 10,
        prepayRate: 0,
        contractType: "반납형",
        productType: "장기렌트",
        customerType: "individual",
        resultMonthly: 650_000,
        bestFinanceCompany: "테스트캐피탈",
        scenarioType: "standard",
        pricingStatus: "CALCULATED",
        rangeExceeded: false,
        clickedApply: false,
        deviceType: "mobile",
        referrer: null,
        userAgent: null,
        ipHash: null,
        createdAt: new Date("2026-07-14T06:00:00.000Z"),
        calculatedAt: new Date("2026-07-14T07:00:00.000Z"),
      },
    ]);
    mocks.countCalculations.mockResolvedValue(1);
    mocks.findTrims.mockResolvedValue([{ id: "trim-1", name: "기본 트림" }]);
    mocks.findMembers.mockResolvedValue([
      { supabaseId: "member-1", name: "카카오회원", phone: "010-1234-5678" },
    ]);
    mocks.findOptions.mockResolvedValue([
      { id: "option-1", name: "현재 옵션명", price: 2_000_000 },
      { id: "option-2", name: "현재 두 번째 옵션", price: 500_000 },
    ]);
  });

  it("returns newest calculations with linked trim and member data", async () => {
    const result = await getAdminQuoteCalculations(2, 50);

    expect(mocks.findCalculations).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { calculatedAt: "desc" },
        where: { clickedApply: false },
        skip: 50,
        take: 50,
        select: expect.not.objectContaining({
          ipHash: expect.anything(),
          userAgent: expect.anything(),
        }),
      })
    );
    expect(result).toEqual({
      total: 1,
      data: [
        expect.objectContaining({
          id: "calc-1",
          customerName: "카카오회원",
          phone: "010-1234-5678",
          userType: "Member",
          vehicleBrand: "테스트",
          trimName: "저장 당시 트림",
          optionCount: 1,
          selectedOptions: [
            { id: "option-1", name: "저장 당시 옵션", price: 1_000_000 },
          ],
          totalVehiclePrice: 40_300_000,
          pricingStatus: "CALCULATED",
          clickedApply: false,
          createdAt: "2026-07-14T06:00:00.000Z",
          calculatedAt: "2026-07-14T07:00:00.000Z",
        }),
      ],
    });
    expect(mocks.countCalculations).toHaveBeenCalledWith({
      where: { clickedApply: false },
    });
  });

  it("skips member and trim lookups when a page is empty", async () => {
    mocks.findCalculations.mockResolvedValue([]);
    mocks.countCalculations.mockResolvedValue(0);

    const result = await getAdminQuoteCalculations();

    expect(result).toEqual({ data: [], total: 0 });
    expect(mocks.findTrims).not.toHaveBeenCalled();
    expect(mocks.findMembers).not.toHaveBeenCalled();
    expect(mocks.findOptions).not.toHaveBeenCalled();
  });
});
