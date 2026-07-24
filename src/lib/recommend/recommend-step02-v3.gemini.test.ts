import { describe, expect, it, vi } from "vitest";
import type { RecommendInput, Step02V3RecommendedVehicle } from "@/types/recommendation";

const mocks = vi.hoisted(() => ({
  generateStep02V3Reason: vi.fn(),
}));

vi.mock("@/lib/llm-reason", () => ({
  generateStep02V3Reason: mocks.generateStep02V3Reason,
}));

import { finalizeStep02V3Reasons } from "./recommend-step02-v3";

const input: RecommendInput = {
  recommendationVersion: "step02-v3",
  industry: "개인사업자",
  industryDetail: "영업직",
  preferences: ["family-leisure", "가족"],
  stylePreference: "family-leisure",
  budgetRange: "lte-800k",
  annualMileage: 20_000,
  fuelPreference: "하이브리드",
  returnType: "반납형",
};

const vehicle = {
  vehicleId: "vehicle-1",
  rank: 1,
  score: 10,
  reason: "조건 기반 추천 이유입니다.",
  highlights: [],
  estimatedMonthly: 734_000,
  scoringVersion: "step02-v3",
  stylePreference: "family-leisure",
  styleScore: 5,
  followupBonus: 1,
  autoConditionScore: 0,
  rankScore: 6,
  tieBreak: {
    modelYear: 2026,
    companyPriority: 0,
    immediateDeliveryAvailable: false,
    availableStockCount: 0,
    profitPriority: 0,
    slug: "kia-11573",
  },
  vehicle: {
    name: "디 올 뉴 팰리세이드",
    brand: "현대",
    category: "SUV",
    thumbnailUrl: "/vehicle.webp",
    defaultTrimName: "프레스티지",
    defaultTrimPrice: 45_000_000,
    slug: "kia-11573",
    popularConfigs: [],
  },
  scenarios: {
    conservative: { monthlyPayment: 0, depositAmount: 0, prepayAmount: 0, contractMonths: 36, annualMileage: 20_000, contractType: "반납형" },
    standard: { monthlyPayment: 0, depositAmount: 0, prepayAmount: 0, contractMonths: 36, annualMileage: 20_000, contractType: "반납형" },
    aggressive: { monthlyPayment: 0, depositAmount: 0, prepayAmount: 0, contractMonths: 36, annualMileage: 20_000, contractType: "반납형" },
  },
} satisfies Step02V3RecommendedVehicle;

describe("finalizeStep02V3Reasons", () => {
  it("replaces the deterministic reason with the Gemini reason for the current engine", async () => {
    mocks.generateStep02V3Reason.mockResolvedValue("가족과 함께 이동할 때 여유로운 공간을 기대할 수 있는 차량입니다.");

    const result = await finalizeStep02V3Reasons([vehicle], input);

    expect(mocks.generateStep02V3Reason).toHaveBeenCalledWith(expect.objectContaining({
      industry: "개인사업자",
      industryDetail: "영업직",
      budgetRange: "lte-800k",
      annualMileage: 20_000,
      fuelPreference: "하이브리드",
      vehicleName: "디 올 뉴 팰리세이드",
      fallback: "조건 기반 추천 이유입니다.",
    }));
    expect(result[0]?.reason).toBe("가족과 함께 이동할 때 여유로운 공간을 기대할 수 있는 차량입니다.");
  });
});
