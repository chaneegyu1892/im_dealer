import { describe, expect, it } from "vitest";
import { generateOverlapAuditInputs, overlapAuditInputKey } from "./overlap-audit-matrix";

describe("overlap audit matrix", () => {
  it("generates every valid questionnaire state exactly once", () => {
    const inputs = generateOverlapAuditInputs();
    expect(inputs).toHaveLength(19_845);
    expect(new Set(inputs.map(overlapAuditInputKey)).size).toBe(inputs.length);
  });

  it("keeps details and charging strictly conditional", () => {
    for (const input of generateOverlapAuditInputs()) {
      expect(input.situationPreference === "가족").toBe("childDetail" in input);
      expect(input.situationPreference === "화물").toBe("cargoDetail" in input);
      expect(input.fuelPreference === "전기차").toBe("chargingEnvironment" in input);
    }
  });
});
