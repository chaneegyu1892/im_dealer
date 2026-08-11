import { describe, expect, it } from "vitest";
import {
  decideReferralAttribution,
  kstMonthRange,
  REFERRAL_MONTHLY_CAP,
} from "./attribution";

const base = {
  inviteeUserId: "invitee-1",
  inviterUserId: "inviter-1",
  inviterIsActive: true,
  inviterKakaoId: "k-1",
  inviteeKakaoId: "k-2",
  alreadyAttributed: false,
  inviterMonthCount: 0,
  isFirstProfileComplete: true,
  code: "K4821",
};

describe("decideReferralAttribution", () => {
  it("accepts a valid first-time referral", () => {
    expect(decideReferralAttribution(base)).toEqual({
      ok: true,
      inviterUserId: "inviter-1",
      code: "K4821",
    });
  });

  it("rejects self referral and monthly cap", () => {
    expect(
      decideReferralAttribution({ ...base, inviterUserId: "invitee-1" }),
    ).toEqual({ ok: false, reason: "SELF_REFERRAL" });

    expect(
      decideReferralAttribution({
        ...base,
        inviterKakaoId: "same",
        inviteeKakaoId: "same",
      }),
    ).toEqual({ ok: false, reason: "SELF_REFERRAL" });

    expect(
      decideReferralAttribution({
        ...base,
        inviterMonthCount: REFERRAL_MONTHLY_CAP,
      }),
    ).toEqual({ ok: false, reason: "MONTHLY_CAP" });
  });

  it("rejects inactive inviter, duplicate, and non-new profile", () => {
    expect(
      decideReferralAttribution({ ...base, inviterIsActive: false }),
    ).toEqual({ ok: false, reason: "INVITER_INACTIVE" });
    expect(
      decideReferralAttribution({ ...base, alreadyAttributed: true }),
    ).toEqual({ ok: false, reason: "ALREADY_ATTRIBUTED" });
    expect(
      decideReferralAttribution({ ...base, isFirstProfileComplete: false }),
    ).toEqual({ ok: false, reason: "NOT_NEW_PROFILE" });
  });
});

describe("kstMonthRange", () => {
  it("returns a non-empty month window", () => {
    const { start, end } = kstMonthRange(new Date("2026-08-15T12:00:00+09:00"));
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
