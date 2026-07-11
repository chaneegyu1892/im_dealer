import { describe, expect, it } from "vitest";
import { overlapProfileSchema, type SuitabilityLevel } from "./overlap-profile";
import { scoreOverlapVehicle, type OverlapScoringInput } from "./overlap-scoring";

function levelMap(level: SuitabilityLevel) {
  return {
    industry: { 법인: level, 개인사업자: level, 개인: level },
    primaryPreference: {
      안정감: level,
      주차편의: level,
      경제성: level,
      고급: level,
    },
    additionalCondition: {
      family: {
        default: level,
        details: { 영유아: level, 미취학: level, 초등: level, "중학생+": level },
      },
      cargo: {
        default: level,
        details: { "소형 박스": level, "대형 화물": level },
      },
    },
    annualMileage: { "10000": level, "20000": level, "30000": level },
    region: { 일반: level, "강원·산간": level, 제주: level },
  };
}

function profile(level: SuitabilityLevel, fuelGroup: "EV" | "HEV" | "ICE" = "ICE") {
  return overlapProfileSchema.parse({
    version: "overlap-v2",
    fuelGroup,
    scores: levelMap(level),
    companyPriority: 0,
    profitPriority: 0,
    ...(fuelGroup === "EV"
      ? { chargingFit: { 자택: "best", 직장: "fit", 외부: "support", 없음: "none" } }
      : {}),
  });
}

const bestInput: OverlapScoringInput = {
  industry: "법인",
  industryDetail: "1대",
  primaryPreference: "안정감",
  situationPreference: "가족",
  childDetail: "영유아",
  annualMileage: 10_000,
  fuelPreference: "가솔린/디젤",
  residenceRegion: "일반",
};

describe("scoreOverlapVehicle", () => {
  const chargingCases: Array<["자택" | "직장" | "외부" | "없음", number]> = [
    ["자택", 0.04],
    ["직장", 0.02],
    ["외부", 0],
    ["없음", -0.04],
  ];

  it("computes the exact all-best PDF maximum", () => {
    const result = scoreOverlapVehicle(bestInput, profile("best"));
    expect(result.documentScore).toBe(22.5);
    expect(result.chargingAdjustment).toBe(0);
    expect(result.rankScore).toBe(22.5);
    expect(result.contributions.filter((item) => item.kind === "document")).toHaveLength(5);
  });

  it("returns zero for all-none without a hidden base score", () => {
    const result = scoreOverlapVehicle(
      {
        industry: "개인",
        industryDetail: "혼자",
        annualMileage: 30_000,
        fuelPreference: "상관없음",
        residenceRegion: "제주",
      },
      profile("none")
    );
    expect(result).toMatchObject({ documentScore: 0, chargingAdjustment: 0, rankScore: 0 });
    expect(result.contributions.every((item) => item.weightedPoints === 0)).toBe(true);
  });

  it("uses child detail as the single additional-condition contribution", () => {
    const value = profile("none");
    value.scores.additionalCondition.family.default = "best";
    value.scores.additionalCondition.family.details.영유아 = "support";
    value.scores.additionalCondition.family.details.미취학 = "fit";

    const infant = scoreOverlapVehicle(bestInput, value);
    const preschool = scoreOverlapVehicle({ ...bestInput, childDetail: "미취학" }, value);
    const infantAdditional = infant.contributions.find(
      (item) => item.axis === "additionalCondition"
    );
    const preschoolAdditional = preschool.contributions.find(
      (item) => item.axis === "additionalCondition"
    );

    expect(infantAdditional).toMatchObject({ level: "support", weightedPoints: 1 });
    expect(preschoolAdditional).toMatchObject({ level: "fit", weightedPoints: 3 });
    expect(preschool.documentScore - infant.documentScore).toBe(2);
  });

  it("uses cargo detail without adding the cargo parent score", () => {
    const value = profile("none");
    value.scores.additionalCondition.cargo.default = "best";
    value.scores.additionalCondition.cargo.details["소형 박스"] = "fit";
    const result = scoreOverlapVehicle(
      {
        ...bestInput,
        situationPreference: "화물",
        cargoDetail: "소형 박스",
      },
      value
    );
    expect(result.documentScore).toBe(3);
  });

  it.each(chargingCases)("applies the exact EV %s micro-adjustment", (chargingEnvironment, expected) => {
    const input: OverlapScoringInput = {
      ...bestInput,
      fuelPreference: "전기차",
      chargingEnvironment,
    };
    const result = scoreOverlapVehicle(input, profile("none", "EV"));
    expect(result.chargingAdjustment).toBe(expected);
    expect(result.rankScore).toBe(expected);
  });

  it("does not apply charging to a non-EV selection", () => {
    const result = scoreOverlapVehicle(
      { ...bestInput, fuelPreference: "상관없음" },
      profile("best", "EV")
    );
    expect(result.chargingAdjustment).toBe(0);
    expect(result.contributions.some((item) => item.kind === "charging")).toBe(false);
  });

  it("is deterministic and remains bounded away from legacy additive scores", () => {
    const first = scoreOverlapVehicle(bestInput, profile("best"));
    const second = scoreOverlapVehicle(bestInput, profile("best"));
    expect(second).toEqual(first);
    expect(first.documentScore).toBeLessThan(50);
  });
});
