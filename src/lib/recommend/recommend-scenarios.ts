import {
  calculateMultiFinanceQuote,
  type CalcInput,
  type RateConfigData,
} from "@/lib/quote-calculator";
import { PUBLIC_CARD_QUOTE_CONDITION } from "@/constants/quote-defaults";
import type { RecommendScenario, RecommendScenarios } from "@/types/recommendation";

interface ScenarioBuildInput {
  readonly vehiclePrice: number;
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
    contractMonths: PUBLIC_CARD_QUOTE_CONDITION.contractMonths,
    annualMileage: PUBLIC_CARD_QUOTE_CONDITION.annualMileage,
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
    contractMonths: PUBLIC_CARD_QUOTE_CONDITION.contractMonths,
    annualMileage: PUBLIC_CARD_QUOTE_CONDITION.annualMileage,
    contractType: PUBLIC_CARD_QUOTE_CONDITION.contractType,
  } : {
    monthlyPayment: input.estimatedMonthly,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: PUBLIC_CARD_QUOTE_CONDITION.contractMonths,
    annualMileage: PUBLIC_CARD_QUOTE_CONDITION.annualMileage,
    contractType: PUBLIC_CARD_QUOTE_CONDITION.contractType,
  };
}

export function buildRecommendScenarios(input: ScenarioBuildInput): RecommendScenarios {
  return {
    conservative: calculateScenario(input, 20, 0),
    standard: calculateScenario(input, 0, 0),
    aggressive: calculateScenario(input, 0, 30),
  };
}
