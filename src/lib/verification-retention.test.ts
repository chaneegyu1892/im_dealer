import { describe, expect, it } from "vitest";
import { isVerificationComplete } from "@/lib/verification-retention";

describe("isVerificationComplete", () => {
  it("classifies a fully successful required check set as complete", () => {
    expect(
      isVerificationComplete({
        licenseVerified: true,
        insuranceVerified: true,
        bizVerified: false,
        needsInsurance: true,
        needsBiz: false,
      })
    ).toBe(true);
  });

  it.each([
    {
      licenseVerified: false,
      insuranceVerified: true,
      bizVerified: true,
      needsInsurance: true,
      needsBiz: true,
    },
    {
      licenseVerified: true,
      insuranceVerified: false,
      bizVerified: true,
      needsInsurance: true,
      needsBiz: true,
    },
    {
      licenseVerified: true,
      insuranceVerified: true,
      bizVerified: false,
      needsInsurance: true,
      needsBiz: true,
    },
  ])("keeps failed or partial attempts in the incomplete retention class", (checks) => {
    expect(isVerificationComplete(checks)).toBe(false);
  });
});
