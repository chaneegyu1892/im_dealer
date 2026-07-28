import { describe, expect, it } from "vitest";
import { recommendRequestSchema } from "@/lib/recommend/recommend-request";
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
      budgetRange: "lte-1000k",
    })).toBe(true);
  });

  it("새 흐름은 월예산만 보내고 서버 소유 기본값을 만들지 않는다", () => {
    const input = buildRecommendInput({
      ...INITIAL_RECOMMEND_FLOW_STATE,
      industry: "개인사업자",
      budgetRange: "gte-1000k",
      simplePreference: "low-running-cost",
      situationPreference: "__situation_none",
      annualMileage: 20_000,
      fuelPreference: "하이브리드",
    });

    expect(input).toMatchObject({
      industry: "개인사업자",
      recommendationVersion: "step02-v3",
      budgetRange: "gte-1000k",
      stylePreference: "low-running-cost",
      preferences: ["low-running-cost"],
    });
    expect(input).not.toHaveProperty("budgetMin");
    expect(input).not.toHaveProperty("industryDetail");
  });

  it("월 50만원 이하와 고급차 조합은 추천 API 입력 계약을 통과한다", () => {
    const input = buildRecommendInput({
      ...INITIAL_RECOMMEND_FLOW_STATE,
      industry: "개인",
      budgetRange: "lte-500k",
      simplePreference: "premium-formal",
      situationPreference: "__situation_none",
      annualMileage: 20_000,
      fuelPreference: "상관없음",
    });

    expect(recommendRequestSchema.safeParse(input).success).toBe(true);
  });

  it("v3 클라이언트는 예산 범위 ID만 보내고 내부 상하한을 보내지 않는다", () => {
    const input = buildRecommendInput({
      ...INITIAL_RECOMMEND_FLOW_STATE,
      industry: "개인",
      budgetRange: "lte-800k",
      simplePreference: "city-compact",
      situationPreference: "__situation_none",
      annualMileage: 20_000,
      fuelPreference: "상관없음",
    });

    expect(input.budgetRange).toBe("lte-800k");
    expect(input).not.toHaveProperty("budgetMin");
    expect(input).not.toHaveProperty("budgetMax");
  });
});
