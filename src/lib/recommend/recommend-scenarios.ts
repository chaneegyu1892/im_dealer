import {
  calculateMultiFinanceQuote,
  type CalcInput,
  type RateConfigData,
} from "@/lib/quote-calculator";
import type { RecommendScenario, RecommendScenarios } from "@/types/recommendation";

interface ScenarioBuildInput {
  readonly vehiclePrice: number;
  readonly annualMileage: 10_000 | 20_000 | 30_000;
  readonly vehicleSurchargeRate: number;
  readonly rankSurchargeRates: readonly number[];
  readonly rateConfigs: readonly RateConfigData[];
  readonly estimatedMonthly: number;
}

function calculateScenario(
  input: ScenarioBuildInput,
  depositRate: number,
  prepayRate: number
): RecommendScenario {
  const calcInput: CalcInput = {
    vehiclePrice: input.vehiclePrice,
    contractMonths: 48,
    annualMileage: input.annualMileage,
    depositRate,
    prepayRate,
    vehicleSurchargeRate: input.vehicleSurchargeRate,
    rankSurchargeRates: [...input.rankSurchargeRates],
    rateConfigs: [...input.rateConfigs],
  };
  const best = calculateMultiFinanceQuote(calcInput)[0];
  return best ? {
    monthlyPayment: best.monthlyPayment,
    depositAmount: best.breakdown.depositAmount,
    prepayAmount: best.breakdown.prepayAmount,
    contractMonths: 48,
    annualMileage: input.annualMileage,
    contractType: "반납형",
  } : {
    monthlyPayment: input.estimatedMonthly,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 48,
    annualMileage: input.annualMileage,
    contractType: "반납형",
  };
}

export function buildRecommendScenarios(input: ScenarioBuildInput): RecommendScenarios {
  return {
    conservative: calculateScenario(input, 20, 0),
    standard: calculateScenario(input, 0, 0),
    aggressive: calculateScenario(input, 0, 30),
  };
}
