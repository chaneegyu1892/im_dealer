import { describe, expect, it } from "vitest";
import { overlapProfileSchema } from "./overlap-profile";
import {
  assessOperationalEligibility,
  type OperationalVehicleSnapshot,
} from "./operational-eligibility";

function matrix(value: number) {
  return {
    "36_10000": value,
    "36_20000": value,
    "36_30000": value,
    "48_10000": value,
    "48_20000": value,
    "48_30000": value,
    "60_10000": value,
    "60_20000": value,
    "60_30000": value,
  };
}

function validProfile() {
  return overlapProfileSchema.parse({
    version: "overlap-v2",
    fuelGroup: "HEV",
    companyPriority: 0,
    profitPriority: 0,
    scores: {
      industry: { 법인: "best", 개인사업자: "fit", 개인: "support" },
      primaryPreference: {
        안정감: "best",
        주차편의: "fit",
        경제성: "support",
        고급: "none",
      },
      additionalCondition: {
        family: {
          default: "best",
          details: { 영유아: "best", 미취학: "fit", 초등: "support", "중학생+": "none" },
        },
        cargo: {
          default: "support",
          details: { "소형 박스": "support", "대형 화물": "none" },
        },
      },
      annualMileage: { "10000": "support", "20000": "best", "30000": "fit" },
      region: { 일반: "best", "강원·산간": "fit", 제주: "support" },
    },
  });
}

function rateSheet(rate: number) {
  return {
    id: "rate-1",
    isActive: true,
    minVehiclePrice: 30_000_000,
    maxVehiclePrice: 50_000_000,
    minRateMatrix: matrix(rate),
    maxRateMatrix: matrix(rate),
    depositDiscountRate: -0.000523,
    prepayAdjustRate: 0.000073,
    financeCompany: {
      id: "finance-1",
      name: "테스트캐피탈",
      isActive: true,
      surchargeRate: 0,
    },
  };
}

function snapshot(): OperationalVehicleSnapshot {
  return {
    vehicleId: "vehicle-1",
    slug: "kia-test-hev",
    brand: "기아",
    name: "테스트 HEV",
    category: "SUV",
    isVisible: true,
    config: { isActive: true, profile: validProfile() },
    trims: [
      {
        id: "trim-default",
        name: "2026년형 기본",
        price: 40_000_000,
        isDefault: true,
        isVisible: true,
        lineup: { name: "2026년형", isVisible: true },
        rateSheets: [rateSheet(0.02)],
      },
    ],
  };
}

describe("assessOperationalEligibility", () => {
  it.each([
    ["excluded_vehicle_class", () => ({ ...snapshot(), slug: "kia-11792" })],
    ["hidden", () => ({ ...snapshot(), isVisible: false })],
    ["no_profile", () => ({ ...snapshot(), config: null })],
    ["inactive_profile", () => ({ ...snapshot(), config: { isActive: false, profile: validProfile() } })],
    ["invalid_profile", () => ({ ...snapshot(), config: { isActive: true, profile: { version: "overlap-v2" } } })],
    ["no_visible_latest_trim", () => ({ ...snapshot(), trims: [] })],
    ["no_valid_active_rate", () => ({
      ...snapshot(),
      trims: [{ ...snapshot().trims[0], rateSheets: [] }],
    })],
    ["non_positive_quote", () => ({
      ...snapshot(),
      trims: [{ ...snapshot().trims[0], rateSheets: [rateSheet(0)] }],
    })],
  ])("returns %s", (expected, build) => {
    expect(assessOperationalEligibility(build(), 20_000).status).toBe(expected);
  });

  it("returns parsed profile, deterministic trim, rates, and a positive quote", () => {
    const base = snapshot();
    const value: OperationalVehicleSnapshot = {
      ...base,
      trims: [
        {
        ...base.trims[0],
        id: "trim-cheap",
        price: 35_000_000,
        isDefault: false,
      },
        base.trims[0],
      ],
    };
    const result = assessOperationalEligibility(value, 20_000);
    expect(result.status).toBe("eligible");
    if (result.status === "eligible") {
      expect(result.selectedTrim.id).toBe("trim-default");
      expect(result.estimatedMonthly).toBeGreaterThan(0);
      expect(result.rateConfigs.length).toBe(1);
      expect(result.profile.fuelGroup).toBe("HEV");
    }
  });

  it("falls back to price then trim id after default priority", () => {
    const original = snapshot();
    const base = original.trims[0];
    const value: OperationalVehicleSnapshot = {
      ...original,
      trims: [
        { ...base, id: "trim-z", price: 35_000_000, isDefault: false },
        { ...base, id: "trim-a", price: 35_000_000, isDefault: false },
      ],
    };
    const result = assessOperationalEligibility(value, 20_000);
    expect(result.status).toBe("eligible");
    if (result.status === "eligible") expect(result.selectedTrim.id).toBe("trim-a");
  });
});
