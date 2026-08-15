import { PUBLIC_RESULT_INITIAL_COST } from "@/constants/quote-defaults";
import { isPublicQuoteResultRates } from "@/lib/member-gate";
import type {
  QuoteScenarioDetail,
  QuoteScenarioDetails,
  QuoteScenarioType,
} from "@/types/quote";

export type QuoteInitialRates = {
  readonly depositRate: number;
  readonly prepayRate: number;
};

export const DEFAULT_RESULT_CUSTOM_RATES: QuoteInitialRates = {
  depositRate: PUBLIC_RESULT_INITIAL_COST.depositRate,
  prepayRate: PUBLIC_RESULT_INITIAL_COST.prepayRate,
};

export const DEFAULT_RESULT_COST_MODE = "initial" as const;

/** 견적 결과 첫 페인트는 aggressive(선납 30%). 이후 재계산은 standard 슬롯. */
export function resolveQuoteResultScenario(
  scenarios: QuoteScenarioDetails | undefined,
  rates: QuoteInitialRates,
): QuoteScenarioDetail | undefined {
  if (!scenarios) return undefined;
  if (isPublicQuoteResultRates(rates)) {
    const standard = scenarios.standard;
    if (standard && standard.locked !== true && standard.prepayAmount > 0) {
      return standard;
    }
    const aggressive = scenarios.aggressive;
    if (aggressive && aggressive.locked !== true) {
      return aggressive;
    }
    return aggressive ?? standard;
  }
  return scenarios.standard;
}

export function deriveQuoteScenarioType(rates: QuoteInitialRates): QuoteScenarioType {
  if (rates.depositRate > 0) return "conservative";
  if (rates.prepayRate > 0) return "aggressive";
  return "standard";
}

export function parseQuoteScenarioType(value: unknown): QuoteScenarioType | undefined {
  if (value === "conservative" || value === "standard" || value === "aggressive") {
    return value;
  }
  return undefined;
}

export function realignSelectedQuoteScenarios(
  scenarios: QuoteScenarioDetails,
  scenarioType: QuoteScenarioType,
  baseStandard: QuoteScenarioDetail
): QuoteScenarioDetails {
  switch (scenarioType) {
    case "conservative":
    case "aggressive":
      return {
        ...scenarios,
        [scenarioType]: scenarios.standard,
        standard: baseStandard,
      };
    case "standard":
      return scenarios;
    default: {
      const exhaustiveScenarioType: never = scenarioType;
      return exhaustiveScenarioType;
    }
  }
}
