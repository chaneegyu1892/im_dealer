import { describe, expect, it } from "vitest";
import {
  CHARGING_ADJUSTMENTS,
  OVERLAP_POINTS,
  OVERLAP_WEIGHTS,
  parseOverlapProfile,
} from "./overlap-profile";

function completeScores() {
  return {
    industry: { 법인: "best", 개인사업자: "fit", 개인: "support" },
    primaryPreference: {
      안정감: "best",
      주차편의: "fit",
      경제성: "support",
      고급: "none",
    },
    additionalCondition: {
      family: {
        default: "fit",
        details: {
          영유아: "best",
          미취학: "fit",
          초등: "support",
          "중학생+": "none",
        },
      },
      cargo: {
        default: "support",
        details: { "소형 박스": "fit", "대형 화물": "best" },
      },
    },
    annualMileage: {
      "10000": "best",
      "20000": "fit",
      "30000": "support",
    },
    region: { 일반: "best", "강원·산간": "fit", 제주: "support" },
  };
}

function profile(fuelGroup: "EV" | "HEV" | "ICE") {
  return {
    version: "overlap-v2",
    fuelGroup,
    scores: completeScores(),
    companyPriority: 0,
    profitPriority: 0,
    ...(fuelGroup === "EV"
      ? {
          chargingFit: {
            자택: "best",
            직장: "fit",
            외부: "support",
            없음: "none",
          },
        }
      : {}),
  };
}

describe("overlap-v2 profile boundary", () => {
  const fuelGroups: Array<"EV" | "HEV" | "ICE"> = ["EV", "HEV", "ICE"];

  it.each(fuelGroups)("parses a complete %s profile", (fuel) => {
    const parsed = parseOverlapProfile(profile(fuel));
    expect(parsed.kind).toBe("valid");
    if (parsed.kind === "valid") {
      expect(parsed.profile.fuelGroup).toBe(fuel);
    }
  });

  it("distinguishes legacy and unknown versions", () => {
    expect(parseOverlapProfile({ industry: { 법인: 9 } })).toEqual({
      kind: "legacy",
      version: null,
    });
    expect(parseOverlapProfile({ version: "overlap-v1" })).toEqual({
      kind: "legacy",
      version: "overlap-v1",
    });
  });

  it.each([
    ["missing map key", () => {
      const value = profile("ICE");
      const { 법인, 개인사업자 } = value.scores.industry;
      return {
        ...value,
        scores: { ...value.scores, industry: { 법인, 개인사업자 } },
      };
    }],
    ["extra map key", () => {
      const value = profile("ICE");
      return {
        ...value,
        scores: {
          ...value.scores,
          region: { ...value.scores.region, 해외: "best" },
        },
      };
    }],
    ["invalid level", () => {
      const value = profile("ICE");
      return {
        ...value,
        scores: {
          ...value.scores,
          primaryPreference: {
            ...value.scores.primaryPreference,
            안정감: "great",
          },
        },
      };
    }],
    ["out of range priority", () => ({ ...profile("ICE"), companyPriority: 101 })],
    ["non EV charging data", () => ({
      ...profile("HEV"),
      chargingFit: { 자택: "best", 직장: "fit", 외부: "support", 없음: "none" },
    })],
    ["EV missing charging data", () => {
      const { version, fuelGroup, scores, companyPriority, profitPriority } = profile("EV");
      return { version, fuelGroup, scores, companyPriority, profitPriority };
    }],
  ])("rejects %s", (_label, build) => {
    const parsed = parseOverlapProfile(build());
    expect(parsed.kind).toBe("invalid");
    if (parsed.kind === "invalid") {
      expect(parsed.issues.length).toBeGreaterThan(0);
    }
  });

  it("locks the PDF constants and charging micro-adjustments", () => {
    expect(OVERLAP_POINTS).toEqual({ best: 5, fit: 3, support: 1, none: 0 });
    expect(OVERLAP_WEIGHTS).toEqual({
      industry: 0.6,
      primaryPreference: 1.4,
      additionalCondition: 1,
      annualMileage: 0.8,
      region: 0.7,
    });
    expect(CHARGING_ADJUSTMENTS).toEqual({
      best: 0.04,
      fit: 0.02,
      support: 0,
      none: -0.04,
    });
  });

  it("proves charging cannot reverse a non-tied document score", () => {
    const levels = Object.values(OVERLAP_POINTS);
    const weights = Object.values(OVERLAP_WEIGHTS);
    const scores = new Set<number>();

    function enumerate(index: number, total: number) {
      if (index === weights.length) {
        scores.add(Number(total.toFixed(10)));
        return;
      }
      for (const level of levels) enumerate(index + 1, total + level * weights[index]);
    }

    enumerate(0, 0);
    const sorted = [...scores].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((score, index) => score - sorted[index]);
    expect(sorted).toHaveLength(180);
    expect(Math.min(...gaps)).toBeCloseTo(0.1, 10);
    expect(CHARGING_ADJUSTMENTS.best - CHARGING_ADJUSTMENTS.none).toBeLessThan(0.1);
  });
});
