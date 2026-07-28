import type {
  QuoteScenarioDetail,
  QuoteScenarioDetails,
  QuoteScenarioType,
} from "@/types/quote";

export type QuoteInitialRates = {
  readonly depositRate: number;
  readonly prepayRate: number;
};

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
