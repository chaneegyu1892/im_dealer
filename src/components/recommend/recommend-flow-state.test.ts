import { describe, expect, it } from "vitest";
import {
  INITIAL_RECOMMEND_FLOW_STATE,
  buildRecommendInput,
  isRecommendStepValid,
} from "./recommend-flow-state";

describe("recommend flow state", () => {
  it("고객 유형과 공통 월예산을 모두 골라야 첫 단계를 마칠 수 있다", () => {
    expect(isRecommendStepValid(1, INITIAL_RECOMMEND_FLOW_STATE)).toBe(false);
    expect(isRecommendStepValid(1, {
      ...INITIAL_RECOMMEND_FLOW_STATE,
      industry: "개인",
      budgetMax: 1_000_000,
    })).toBe(true);
  });

  it("새 흐름은 예산을 보내고 업종별 상세값을 만들지 않는다", () => {
    const input = buildRecommendInput({
      ...INITIAL_RECOMMEND_FLOW_STATE,
      industry: "개인사업자",
      budgetMax: 1_500_000,
      simplePreference: "경제성",
      situationPreference: "__situation_none",
      annualMileage: 20_000,
      fuelPreference: "하이브리드",
    });

    expect(input).toMatchObject({
      industry: "개인사업자",
      budgetMin: 0,
      budgetMax: 1_500_000,
      preferences: ["경제성"],
    });
    expect(input).not.toHaveProperty("industryDetail");
  });
});
