import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  _resetKeyCacheForTesting,
  encryptPII,
} from "@/lib/pii";
import { toVerificationDetailView } from "@/lib/verification-view";

describe("toVerificationDetailView", () => {
  beforeEach(() => {
    process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    _resetKeyCacheForTesting();
  });

  it("decrypts provider data server-side and returns only allowlisted display strings", () => {
    const consentedAt = new Date("2026-08-01T01:00:00.000Z");
    const view = toVerificationDetailView({
      customerType: "self_employed",
      licenseVerified: true,
      insuranceVerified: true,
      bizVerified: true,
      licenseData: encrypted({
        resLicenseStatus: "정상",
        resUserNm: "홍길동",
        resLicenseNo: "11-22-333333-44",
      }),
      insuranceData: encrypted({
        resWorkplaceName: "표시할 직장",
        resRegistrationNo: "900101-1234567",
        resHistory: [{ employer: "과거 직장" }],
      }),
      bizData: encrypted({
        resBizStatus: "계속사업자",
        resCompanyNm: "민감한 상호",
        resBusinessNo: "123-45-67890",
      }),
      consentedAt,
      verifiedAt: null,
    });

    expect(view).toEqual({
      customerType: "self_employed",
      licenseVerified: true,
      insuranceVerified: true,
      bizVerified: true,
      licenseStatus: "정상",
      insuranceWorkplace: "표시할 직장",
      bizStatus: "계속사업자",
      consentedAt,
      verifiedAt: null,
    });

    const serialized = JSON.stringify(view);
    for (const forbidden of [
      "connectedId",
      "licenseData",
      "insuranceData",
      "bizData",
      "resUserNm",
      "resRegistrationNo",
      "resCompanyNm",
      "resBusinessNo",
      "\"iv\"",
      "\"tag\"",
      "\"ct\"",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

function encrypted(value: unknown): Prisma.JsonValue {
  return encryptPII(value) as unknown as Prisma.JsonValue;
}
