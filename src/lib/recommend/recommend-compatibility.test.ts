import { describe, expect, it } from "vitest";
import type { VehicleAttrs } from "./vehicle-attributes";
import {
  getLegacyRecommendationCompatibility,
  getOverlapRecommendationCompatibility,
} from "./recommend-compatibility";
import type { ScoreCtx, ScoreInput } from "./scoring";
import type { OverlapScoreResult } from "./overlap-scoring";

const ATTRS: VehicleAttrs = {
  isAwd: false,
  cargoKg: null,
  isRefrigerated: false,
  seating: 5,
  fuel: "가솔린",
  hasSlidingDoor: false,
  hasAdvancedSafety: false,
  isPopular: false,
};

const INPUT: ScoreInput = {
  industry: "개인",
  preferences: [],
  annualMileage: 20_000,
};

function overlapScore(
  primaryLevel: "best" | "fit" | "support" | "none",
  additionalLevel: "best" | "fit" | "support" | "none",
  additionalSelected: boolean = true
): OverlapScoreResult {
  return {
    documentScore: 0,
    chargingAdjustment: 0,
    rankScore: 0,
    contributions: [
      {
        kind: "document",
        axis: "primaryPreference",
        selectedValue: "안정감",
        level: primaryLevel,
        rawPoints: 0,
        weight: 1,
        weightedPoints: 0,
        evidenceLabel: "primary",
      },
      {
        kind: "document",
        axis: "additionalCondition",
        selectedValue: additionalSelected ? "가족" : null,
        level: additionalLevel,
        rawPoints: 0,
        weight: 1,
        weightedPoints: 0,
        evidenceLabel: "additional",
      },
    ],
  };
}

describe("recommendation compatibility", () => {
  it("treats no selected legacy axis as compatible", () => {
    expect(getLegacyRecommendationCompatibility({
      input: INPUT,
      attrs: ATTRS,
      context: {
        category: "세단",
        price: 35_000_000,
        fuelEfficiency: 10,
      },
    })).toBe("compatible");
  });

  it("requires positive net points for each selected legacy primary axis", () => {
    const input: ScoreInput = {
      ...INPUT,
      preferences: ["주차편의"],
      primaryPreference: "주차편의",
    };
    const compact: ScoreCtx = {
      category: "세단",
      price: 20_000_000,
      fuelEfficiency: 10,
    };
    const large: ScoreCtx = {
      category: "SUV",
      price: 60_000_000,
      fuelEfficiency: 10,
    };

    expect(getLegacyRecommendationCompatibility({
      input,
      attrs: ATTRS,
      context: compact,
    })).toBe("compatible");
    expect(getLegacyRecommendationCompatibility({
      input,
      attrs: ATTRS,
      context: large,
    })).toBe("conflict");
  });

  it("requires positive net points for selected family and cargo axes", () => {
    const familyInput: ScoreInput = {
      ...INPUT,
      preferences: ["가족"],
      situationPreference: "가족",
      childDetail: "영유아",
    };
    const cargoInput: ScoreInput = {
      ...INPUT,
      preferences: ["화물"],
      situationPreference: "화물",
      cargoDetail: "대형 화물",
    };

    expect(getLegacyRecommendationCompatibility({
      input: familyInput,
      attrs: ATTRS,
      context: {
        category: "세단",
        price: 35_000_000,
        fuelEfficiency: 10,
      },
    })).toBe("conflict");
    expect(getLegacyRecommendationCompatibility({
      input: cargoInput,
      attrs: { ...ATTRS, cargoKg: 1_000 },
      context: {
        category: "트럭",
        price: 35_000_000,
        fuelEfficiency: 10,
      },
    })).toBe("compatible");
  });

  it("accepts overlap selected axes at support or above and rejects none", () => {
    expect(getOverlapRecommendationCompatibility(
      overlapScore("support", "fit")
    )).toBe("compatible");
    expect(getOverlapRecommendationCompatibility(
      overlapScore("none", "best")
    )).toBe("conflict");
    expect(getOverlapRecommendationCompatibility(
      overlapScore("best", "none")
    )).toBe("conflict");
  });

  it("does not require compatibility for an unselected overlap axis", () => {
    expect(getOverlapRecommendationCompatibility(
      overlapScore("fit", "none", false)
    )).toBe("compatible");
  });
});
