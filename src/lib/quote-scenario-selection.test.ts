import { describe, expect, it } from "vitest";
import {
  deriveQuoteScenarioType,
  parseQuoteScenarioType,
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
});
