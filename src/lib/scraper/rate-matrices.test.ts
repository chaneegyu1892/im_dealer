import { describe, expect, it } from "vitest";
import { buildCollectedRateData, hasUsableRates } from "./rate-matrices";

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

describe("hasUsableRates", () => {
  it("값이 하나라도 있으면 사용 가능으로 본다", () => {
    expect(hasUsableRates({ "36_10000": 500_000, "36_20000": 0 })).toBe(true);
  });

  it("전 칸이 0 이면 사용 불가 — 재수집 대상", () => {
    expect(hasUsableRates({ "36_10000": 0, "36_20000": 0, "36_30000": 0 })).toBe(false);
  });

  it("빈 객체·null·비객체는 사용 불가", () => {
    expect(hasUsableRates({})).toBe(false);
    expect(hasUsableRates(null)).toBe(false);
    expect(hasUsableRates(undefined)).toBe(false);
    expect(hasUsableRates("500000")).toBe(false);
  });

  it("음수·NaN 은 값으로 치지 않는다", () => {
    expect(hasUsableRates({ "36_10000": -1 })).toBe(false);
    expect(hasUsableRates({ "36_10000": Number.NaN })).toBe(false);
  });
});
