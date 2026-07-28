import { describe, expect, it } from "vitest";
import {
  compareRecommendationBudgetProximity,
  getRecommendationBudgetBounds,
  getRecommendationBudgetRange,
  isWithinRecommendationBudget,
  isWithinRecommendationBudgetRange,
} from "./recommendation-budget";

describe("recommendation monthly budget", () => {
  it("월예산은 무보증 대표 월납입금의 상한으로 적용한다", () => {
    expect(isWithinRecommendationBudget(500_000, 500_000)).toBe(true);
    expect(isWithinRecommendationBudget(500_001, 500_000)).toBe(false);
  });

  it("0 또는 미지정 예산은 추천 범위를 제한하지 않는다", () => {
    expect(isWithinRecommendationBudget(2_000_000, 0)).toBe(true);
    expect(isWithinRecommendationBudget(2_000_000, undefined)).toBe(true);
  });

  it.each([
    ["lte-500k", 0, 500_000],
    ["lte-800k", 0, 800_000],
    ["lte-1000k", 0, 1_000_000],
    ["gte-1000k", 1_000_000, 0],
    ["auto", 0, 0],
  ] as const)("%s 계약을 저장용 상하한으로 파생한다", (range, budgetMin, budgetMax) => {
    expect(getRecommendationBudgetBounds(range)).toEqual({ budgetMin, budgetMax });
    expect(getRecommendationBudgetRange(budgetMin, budgetMax)).toBe(range);
  });

  it("100만원 경계는 이하와 이상 모드 모두에 포함된다", () => {
    expect(isWithinRecommendationBudgetRange(1_000_000, "lte-1000k")).toBe(true);
    expect(isWithinRecommendationBudgetRange(1_000_000, "gte-1000k")).toBe(true);
    expect(isWithinRecommendationBudgetRange(1_000_001, "lte-1000k")).toBe(false);
    expect(isWithinRecommendationBudgetRange(999_999, "gte-1000k")).toBe(false);
  });

  it("이하 모드는 아래에서 가까운 순, 이상 모드는 위에서 가까운 순이며 auto는 순서를 바꾸지 않는다", () => {
    expect(compareRecommendationBudgetProximity("lte-800k", 790_000, 700_000)).toBeLessThan(0);
    expect(compareRecommendationBudgetProximity("gte-1000k", 1_010_000, 1_200_000)).toBeLessThan(0);
    expect(compareRecommendationBudgetProximity("auto", 2_000_000, 300_000)).toBe(0);
  });
});
