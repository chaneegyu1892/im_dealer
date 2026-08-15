import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESULT_COST_MODE,
  DEFAULT_RESULT_CUSTOM_RATES,
  deriveQuoteScenarioType,
  parseQuoteScenarioType,
  resolveQuoteResultScenario,
} from "./quote-scenario-selection";

describe("quote scenario selection", () => {
  it("maps a positive deposit to conservative", () => {
    // Given: a final customer state with only a deposit
    const rates = { depositRate: 10, prepayRate: 0 };

    // When: the semantic scenario is derived
    const scenarioType = deriveQuoteScenarioType(rates);

    // Then: deposit maps to the guarantee scenario
    expect(scenarioType).toBe("conservative");
  });

  it("maps a positive prepayment to aggressive", () => {
    // Given: a final customer state with only a prepayment
    const rates = { depositRate: 0, prepayRate: 20 };

    // When: the semantic scenario is derived
    const scenarioType = deriveQuoteScenarioType(rates);

    // Then: prepayment maps to the advance-payment scenario
    expect(scenarioType).toBe("aggressive");
  });

  it("maps zero initial rates to standard", () => {
    // Given: a final customer state without initial payment
    const rates = { depositRate: 0, prepayRate: 0 };

    // When: the semantic scenario is derived
    const scenarioType = deriveQuoteScenarioType(rates);

    // Then: no initial payment maps to no-guarantee
    expect(scenarioType).toBe("standard");
  });

  it("rejects an invalid persisted scenario selection", () => {
    // Given: a legacy breakdown contains an unsupported value
    const savedScenarioType: unknown = "experimental";

    // When: the persistence boundary parses the selection
    const scenarioType = parseQuoteScenarioType(savedScenarioType);

    // Then: the caller receives the legacy fallback signal
    expect(scenarioType).toBeUndefined();
  });

  it("defaults the result screen to prepay 30% and initial cost mode", () => {
    expect(DEFAULT_RESULT_CUSTOM_RATES).toEqual({ depositRate: 0, prepayRate: 30 });
    expect(DEFAULT_RESULT_COST_MODE).toBe("initial");
  });

  it("paints the first result from aggressive, then the recalculated standard slot", () => {
    const scenarios = {
      conservative: {
        monthlyPayment: 610_000,
        depositAmount: 8_000_000,
        prepayAmount: 0,
        contractMonths: 60,
        annualMileage: 20_000,
        contractType: "반납형",
        bestFinanceCompany: "A",
        purchaseSurcharge: 0,
        breakdown: null,
        surcharges: null,
        allFinanceResults: [],
      },
      standard: {
        monthlyPayment: 700_000,
        depositAmount: 0,
        prepayAmount: 0,
        contractMonths: 60,
        annualMileage: 20_000,
        contractType: "반납형",
        bestFinanceCompany: "A",
        purchaseSurcharge: 0,
        breakdown: null,
        surcharges: null,
        allFinanceResults: [],
      },
      aggressive: {
        monthlyPayment: 530_000,
        depositAmount: 0,
        prepayAmount: 12_000_000,
        contractMonths: 60,
        annualMileage: 20_000,
        contractType: "반납형",
        bestFinanceCompany: "A",
        purchaseSurcharge: 0,
        breakdown: null,
        surcharges: null,
        allFinanceResults: [],
      },
    };

    expect(
      resolveQuoteResultScenario(scenarios, { depositRate: 0, prepayRate: 30 })?.monthlyPayment,
    ).toBe(530_000);

    const recalculated = {
      ...scenarios,
      standard: { ...scenarios.standard, monthlyPayment: 528_000, prepayAmount: 12_000_000 },
    };
    expect(
      resolveQuoteResultScenario(recalculated, { depositRate: 0, prepayRate: 30 })?.monthlyPayment,
    ).toBe(528_000);

    expect(
      resolveQuoteResultScenario(scenarios, { depositRate: 0, prepayRate: 0 })?.monthlyPayment,
    ).toBe(700_000);
  });
});
