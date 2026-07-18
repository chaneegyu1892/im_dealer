import { describe, expect, it } from "vitest";
import { isWithinRecommendationBudget } from "./recommendation-budget";

describe("recommendation monthly budget", () => {
  it("월예산은 무보증 대표 월납입금의 상한으로 적용한다", () => {
    expect(isWithinRecommendationBudget(500_000, 500_000)).toBe(true);
    expect(isWithinRecommendationBudget(500_001, 500_000)).toBe(false);
  });

  it("0 또는 미지정 예산은 추천 범위를 제한하지 않는다", () => {
    expect(isWithinRecommendationBudget(2_000_000, 0)).toBe(true);
    expect(isWithinRecommendationBudget(2_000_000, undefined)).toBe(true);
  });
});
