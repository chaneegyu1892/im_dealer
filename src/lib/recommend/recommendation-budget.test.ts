import { describe, expect, it } from "vitest";
import {
  compareRecommendationBudgetProximity,
  getRecommendationBudgetBounds,
  getRecommendationBudgetOvershoot,
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

  it("이하 모드의 상한 경계는 포함하고 초과는 제외한다", () => {
    expect(isWithinRecommendationBudgetRange(1_000_000, "lte-1000k")).toBe(true);
    expect(isWithinRecommendationBudgetRange(1_000_001, "lte-1000k")).toBe(false);
  });

  // "예산 여유 있어요"는 하한이 아니라 상한 해제다. 하한으로 걸러버리면
  // 인기순위 풀 최고가가 100만원에 못 미쳐 결과가 영구히 0건이 된다.
  it("여유 모드는 월납입금으로 후보를 거르지 않는다", () => {
    expect(isWithinRecommendationBudgetRange(999_999, "gte-1000k")).toBe(true);
    expect(isWithinRecommendationBudgetRange(320_000, "gte-1000k")).toBe(true);
    expect(isWithinRecommendationBudgetRange(2_000_000, "gte-1000k")).toBe(true);
  });

  it("이하 모드는 상한에 가장 가까운 차를 앞세우고 auto는 순서를 바꾸지 않는다", () => {
    expect(compareRecommendationBudgetProximity("lte-800k", 790_000, 700_000)).toBeLessThan(0);
    expect(compareRecommendationBudgetProximity("auto", 2_000_000, 300_000)).toBe(0);
  });

  // 하한만 없애고 정렬을 그대로 두면 "예산 여유 있어요"에 가장 싼 차가 뜬다.
  it("여유 모드는 사양·등급이 높은 비싼 차를 앞세운다", () => {
    expect(compareRecommendationBudgetProximity("gte-1000k", 924_000, 634_000)).toBeLessThan(0);
    expect(compareRecommendationBudgetProximity("gte-1000k", 634_000, 924_000)).toBeGreaterThan(0);
  });
});

describe("예산 초과 폭(근접 후보 안내용)", () => {
  it("이하 모드에서 상한을 넘은 만큼을 돌려준다", () => {
    expect(getRecommendationBudgetOvershoot("lte-500k", 524_000)).toBe(24_000);
    expect(getRecommendationBudgetOvershoot("lte-800k", 924_790)).toBe(124_790);
  });

  it("상한 안에 드는 차는 초과 폭이 없다", () => {
    expect(getRecommendationBudgetOvershoot("lte-500k", 500_000)).toBeNull();
    expect(getRecommendationBudgetOvershoot("lte-500k", 430_000)).toBeNull();
  });

  it("상한이 없는 모드에는 초과 폭 개념이 없다", () => {
    expect(getRecommendationBudgetOvershoot("auto", 2_000_000)).toBeNull();
    expect(getRecommendationBudgetOvershoot("gte-1000k", 2_000_000)).toBeNull();
  });
});
