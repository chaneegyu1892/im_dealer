import { describe, expect, it } from "vitest";
import type { OverlapContribution } from "./overlap-scoring";
import { generateOverlapReason } from "./reason";

function contribution(
  axis: OverlapContribution["axis"],
  weightedPoints: number,
  evidenceLabel: string,
  selectedDetail?: string
): OverlapContribution {
  return {
    kind: axis === "chargingEnvironment" ? "charging" : "document",
    axis,
    selectedValue: evidenceLabel,
    ...(selectedDetail ? { selectedDetail } : {}),
    level: weightedPoints > 0 ? "best" : "none",
    rawPoints: weightedPoints > 0 ? 5 : 0,
    weight: axis === "chargingEnvironment" ? null : 1,
    weightedPoints,
    evidenceLabel,
  };
}

describe("generateOverlapReason", () => {
  it("uses the top three positive contributions in deterministic order", () => {
    const values = [
      contribution("region", 3, "제주 운행"),
      contribution("industry", 3, "법인 등록"),
      contribution("primaryPreference", 5, "큰 차 선호"),
      contribution("annualMileage", 2, "연 2만km"),
    ];
    expect(generateOverlapReason(values)).toBe(
      "큰 차 선호, 법인 등록, 제주 운행 조건을 반영한 추천입니다."
    );
  });

  it("mentions selected detail and positive charging evidence", () => {
    const values = [
      contribution("additionalCondition", 5, "가족 조건", "영유아"),
      contribution("chargingEnvironment", 0.04, "자택 충전환경 적합도"),
    ];
    expect(generateOverlapReason(values)).toBe(
      "영유아 가족 조건, 자택 충전환경 적합도 조건을 반영한 추천입니다."
    );
  });

  it("uses the exact zero-positive fallback", () => {
    expect(generateOverlapReason([contribution("region", 0, "일반 지역")])).toBe(
      "선택한 조건을 기준으로 추천된 차량입니다."
    );
  });
});
