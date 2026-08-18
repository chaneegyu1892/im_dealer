import { describe, expect, it } from "vitest";
import {
  generateReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_PATTERN,
} from "./code";

describe("referral code", () => {
  it("generates letter + 6 digits", () => {
    const code = generateReferralCode(() => 0);
    expect(code).toMatch(REFERRAL_CODE_PATTERN);
    expect(code).toHaveLength(7);
    expect(code).toBe("A000000");
  });

  it("normalizes and rejects invalid codes", () => {
    expect(normalizeReferralCode("k4821")).toBe("K4821");
    expect(normalizeReferralCode(" K4821 ")).toBe("K4821");
    expect(normalizeReferralCode("k482109")).toBe("K482109");
    expect(normalizeReferralCode("4821K")).toBeNull();
    expect(normalizeReferralCode("AB123")).toBeNull();
    expect(normalizeReferralCode("A48210")).toBeNull();
    expect(normalizeReferralCode("")).toBeNull();
  });
});
