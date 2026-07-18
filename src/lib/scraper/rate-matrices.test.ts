import { describe, expect, it } from "vitest";
import { buildCollectedRateData } from "./rate-matrices";

describe("buildCollectedRateData", () => {
  it("preserves collected deposit and prepay quotes in the stored matrices", () => {
    const data = buildCollectedRateData({ "36_10000": 500_000 }, 40_000_000, 470_000, 400_000);

    expect(data.baseRates["36_10000"]).toBe(500_000);
    expect(data.depositRates["36_10000"]).toBe(470_000);
    expect(data.prepayRates["36_10000"]).toBe(400_000);
    expect(data.depositDiscountRate).toBeLessThan(0);
    expect(data.prepayAdjustRate).not.toBe(0);
  });
});
