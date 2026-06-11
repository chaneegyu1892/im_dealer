import { describe, expect, it } from "vitest";
import {
  buildCapitalRateFingerprint,
  buildCapitalRateGroupName,
  getCapitalRateGroupColor,
} from "./capital-rate-groups";

const rates = {
  "36_10000": 100,
  "36_20000": 200,
  "36_30000": 300,
  "48_10000": 400,
  "48_20000": 500,
  "48_30000": 600,
  "60_10000": 700,
  "60_20000": 800,
  "60_30000": 900,
};

function sheet(overrides: Record<string, unknown> = {}) {
  return {
    id: "sheet-a",
    financeCompanyId: "fc-1",
    trimId: "trim-a",
    productType: "장기렌트",
    weekOf: "2026-06-01T00:00:00.000Z",
    minVehiclePrice: 40_000_000,
    maxVehiclePrice: 50_000_000,
    minBaseRates: rates,
    minDepositRates: { ...rates, "36_10000": 90 },
    minPrepayRates: { ...rates, "36_10000": 80 },
    maxBaseRates: { ...rates, "36_10000": 110 },
    maxDepositRates: { ...rates, "36_10000": 95 },
    maxPrepayRates: { ...rates, "36_10000": 85 },
    minRateMatrix: { ...rates, "36_10000": 0.01 },
    maxRateMatrix: { ...rates, "36_10000": 0.011 },
    depositDiscountRate: -0.001,
    prepayAdjustRate: 0.002,
    memo: "memo-a",
    createdAt: "2026-06-01T01:00:00.000Z",
    isActive: true,
    ...overrides,
  };
}

describe("capital rate groups", () => {
  it("groups sheets by identical rate values while ignoring registration metadata", () => {
    const first = buildCapitalRateFingerprint(sheet());
    const second = buildCapitalRateFingerprint(
      sheet({
        id: "sheet-b",
        trimId: "trim-b",
        weekOf: "2026-06-08T00:00:00.000Z",
        memo: "different memo",
        createdAt: "2026-06-09T01:00:00.000Z",
        isActive: false,
      })
    );

    expect(second).toBe(first);
  });

  it("separates groups when finance company, product type, or rate values differ", () => {
    const base = buildCapitalRateFingerprint(sheet());

    expect(buildCapitalRateFingerprint(sheet({ financeCompanyId: "fc-2" }))).not.toBe(base);
    expect(buildCapitalRateFingerprint(sheet({ productType: "리스" }))).not.toBe(base);
    expect(
      buildCapitalRateFingerprint(
        sheet({ minRateMatrix: { ...rates, "36_10000": 0.01234 } })
      )
    ).not.toBe(base);
  });

  it("assigns stable human labels and colors", () => {
    expect(buildCapitalRateGroupName(0)).toBe("그룹 A");
    expect(buildCapitalRateGroupName(27)).toBe("그룹 AB");
    expect(getCapitalRateGroupColor(0)).toMatch(/^#/);
    expect(getCapitalRateGroupColor(100)).toMatch(/^#/);
  });
});
