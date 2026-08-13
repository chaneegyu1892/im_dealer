import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calculate: vi.fn(),
}));

vi.mock("@/lib/quote-calculator", () => ({
  calculateMultiFinanceQuote: mocks.calculate,
}));

import {
  buildScenarioSnapshots,
  hasCompleteScenarioSnapshots,
  parseScenarioSnapshots,
} from "./quote-scenario-snapshots";
import type { CalcInput } from "@/lib/quote-calculator";

function financeResult(monthlyPayment: number, input: CalcInput) {
  return {
    financeCompanyId: "finance-1",
    financeCompanyName: "테스트캐피탈",
    rank: 1,
    baseMonthly: monthlyPayment,
    monthlyPayment,
    breakdown: {
      vehiclePrice: input.vehiclePrice,
      recoveryRate: 0.5,
      baseMonthly: monthlyPayment,
      depositAmount: Math.round(input.vehiclePrice * (input.depositRate / 100)),
      prepayAmount: Math.round(input.vehiclePrice * (input.prepayRate / 100)),
      depositDiscount: 0,
      prepayAdjust: 0,
      monthlyBeforeSurcharge: monthlyPayment,
    },
    surcharges: { total: 0 },
    rangeExceeded: false,
  };
}

const baseInput = {
  vehiclePrice: 50_000_000,
  contractMonths: 60,
  annualMileage: 20_000,
  vehicleSurchargeRate: 0,
  rankSurchargeRates: [0, 0.1, 0.2],
  rateConfigs: [],
  contractType: "반납형" as const,
};

describe("buildScenarioSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 조건(보증금/선납금)에 따라 다른 월납입금을 돌려줘 시나리오별 매핑을 검증한다.
    mocks.calculate.mockImplementation((input: CalcInput) => {
      if (input.depositRate === 20) return [financeResult(610_000, input)];
      if (input.prepayRate === 30) return [financeResult(510_000, input)];
      return [financeResult(810_000, input)];
    });
  });

  it("captures all three standard scenarios with per-condition amounts", () => {
    const snapshots = buildScenarioSnapshots(baseInput);

    expect(snapshots).toEqual({
      conservative: {
        monthlyPayment: 610_000,
        depositAmount: 10_000_000,
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
        prepayAmount: 15_000_000,
        bestFinanceCompany: "테스트캐피탈",
        purchaseSurcharge: 0,
      },
    });
  });

  it("adds the 12% purchase surcharge for 인수형 contracts", () => {
    const snapshots = buildScenarioSnapshots({ ...baseInput, contractType: "인수형" });

    expect(snapshots.standard).toMatchObject({
      monthlyPayment: 810_000 + Math.round(810_000 * 0.12),
      purchaseSurcharge: Math.round(810_000 * 0.12),
    });
  });

  it("records null for a scenario no finance company can quote", () => {
    mocks.calculate.mockImplementation((input: CalcInput) =>
      input.prepayRate === 30 ? [] : [financeResult(700_000, input)]
    );

    const snapshots = buildScenarioSnapshots(baseInput);

    expect(snapshots.aggressive).toBeNull();
    expect(snapshots.standard).not.toBeNull();
  });
});

describe("parseScenarioSnapshots", () => {
  const validSnapshot = {
    monthlyPayment: 812_725,
    depositAmount: 0,
    prepayAmount: 0,
    bestFinanceCompany: "롯데캐피탈",
    purchaseSurcharge: 0,
  };

  it("round-trips snapshots serialized through breakdown JSON", () => {
    const stored = JSON.parse(
      JSON.stringify({
        conservative: validSnapshot,
        standard: validSnapshot,
        aggressive: null,
      })
    );

    expect(parseScenarioSnapshots(stored)).toEqual({
      conservative: validSnapshot,
      standard: validSnapshot,
    });
  });

  it("drops malformed entries instead of trusting stored JSON", () => {
    const stored = {
      conservative: { ...validSnapshot, monthlyPayment: "812725" },
      standard: validSnapshot,
      unknownKey: validSnapshot,
    };

    expect(parseScenarioSnapshots(stored)).toEqual({ standard: validSnapshot });
  });

  it("returns null when nothing usable is stored", () => {
    expect(parseScenarioSnapshots(undefined)).toBeNull();
    expect(parseScenarioSnapshots("not-an-object")).toBeNull();
    expect(parseScenarioSnapshots({})).toBeNull();
  });

  it("treats a partial snapshot set as incomplete so live rates are not mixed in", () => {
    expect(hasCompleteScenarioSnapshots(parseScenarioSnapshots({
      conservative: validSnapshot,
      standard: validSnapshot,
      aggressive: null,
    }))).toBe(false);
    expect(hasCompleteScenarioSnapshots(parseScenarioSnapshots({
      conservative: validSnapshot,
      standard: validSnapshot,
      aggressive: validSnapshot,
    }))).toBe(true);
    expect(hasCompleteScenarioSnapshots(null)).toBe(false);
  });
});
