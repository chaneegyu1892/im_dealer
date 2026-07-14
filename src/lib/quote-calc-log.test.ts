import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { quoteCalcLog: { upsert: mocks.upsert } },
}));

import { upsertQuoteCalcLog, upsertQuoteCalcLogs, type QuoteCalcLogWrite } from "./quote-calc-log";

const baseRow: QuoteCalcLogWrite = {
  sessionId: "session-1",
  userId: "member-1",
  vehicleId: "vehicle-1",
  vehicleSlug: "test-car",
  vehicleName: "테스트 차량",
  vehicleBrand: "테스트",
  trimId: "trim-1",
  trimName: "기본 트림",
  trimPrice: 40_000_000,
  discountPrice: 39_000_000,
  optionIds: ["option-1"],
  optionSnapshots: [{ id: "option-1", name: "선루프", price: 1_000_000 }],
  extraOptionsPrice: 0,
  optionsTotalPrice: 1_000_000,
  exteriorColorId: "color-1",
  exteriorColorName: "화이트",
  interiorColorId: null,
  interiorColorName: null,
  colorDelta: 100_000,
  totalVehiclePrice: 40_100_000,
  contractMonths: 60,
  annualMileage: 20_000,
  depositRate: 0,
  prepayRate: 0,
  contractType: "반납형",
  productType: "장기렌트",
  customerType: "individual",
  resultMonthly: 650_000,
  bestFinanceCompany: "테스트캐피탈",
  scenarioType: "standard",
  rangeExceeded: false,
  deviceType: "mobile",
  referrer: null,
  userAgent: "test-agent",
  ipHash: "hash",
};

describe("quote calculation log persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsert.mockResolvedValue({ id: "calc-1" });
  });

  it("uses the session, vehicle, and scenario unique key without resetting clickedApply", async () => {
    await upsertQuoteCalcLog(baseRow);

    expect(mocks.upsert).toHaveBeenCalledWith({
      where: {
        sessionId_vehicleSlug_scenarioType: {
          sessionId: "session-1",
          vehicleSlug: "test-car",
          scenarioType: "standard",
        },
      },
      create: { ...baseRow, calculatedAt: expect.any(Date) },
      update: expect.not.objectContaining({ clickedApply: expect.anything() }),
    });
    expect(mocks.upsert.mock.calls[0]?.[0].update).toMatchObject({
      vehicleName: "테스트 차량",
      trimName: "기본 트림",
      resultMonthly: 650_000,
      calculatedAt: expect.any(Date),
    });
  });

  it("waits for every scenario write", async () => {
    let resolveSecond: (() => void) | undefined;
    mocks.upsert
      .mockResolvedValueOnce({ id: "standard" })
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveSecond = () => resolve({ id: "aggressive" });
        })
      );

    let completed = false;
    const pending = upsertQuoteCalcLogs([
      baseRow,
      { ...baseRow, scenarioType: "aggressive", prepayRate: 30 },
    ]).then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(completed).toBe(false);

    resolveSecond?.();
    await pending;
    expect(completed).toBe(true);
  });
});
