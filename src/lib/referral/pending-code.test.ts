import { afterEach, describe, expect, it } from "vitest";
import {
  PENDING_REFERRAL_STORAGE_KEY,
  persistPendingReferralCode,
  readPendingReferralCode,
  REFERRAL_REDEEM_PATH,
  resolveReferralLoginNext,
} from "./pending-code";

describe("pending referral code", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("persists a valid landing ref for the kakao callback path", () => {
    expect(persistPendingReferralCode("k4821")).toBe("K4821");
    expect(window.sessionStorage.getItem(PENDING_REFERRAL_STORAGE_KEY)).toBe(
      "K4821",
    );
    expect(readPendingReferralCode()).toBe("K4821");
  });

  it("sends a bare login?ref= landing to the mypage redeem path", () => {
    expect(resolveReferralLoginNext("/", "k4821")).toEqual({
      next: REFERRAL_REDEEM_PATH,
      referralCode: "K4821",
    });
    expect(resolveReferralLoginNext("/quote?restore=1", "k4821")).toEqual({
      next: "/quote?restore=1",
      referralCode: "K4821",
    });
  });

  it("ignores an invalid ref so a later login cannot invent a code", () => {
    expect(persistPendingReferralCode("not-a-code")).toBeNull();
    expect(readPendingReferralCode()).toBeNull();
  });
});
