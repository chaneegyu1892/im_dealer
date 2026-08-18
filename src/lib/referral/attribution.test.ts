import { describe, expect, it } from "vitest";
import {
  decideReferralAttribution,
  isReferralEntryWindowOpen,
  kstMonthRange,
  REFERRAL_ENTRY_WINDOW_DAYS,
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
  isWithinEntryWindow: true,
  code: "K4821",
};

describe("decideReferralAttribution", () => {
  it("accepts a valid referral within the entry window", () => {
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

  it("rejects inactive inviter, duplicate, and closed entry window", () => {
    expect(
      decideReferralAttribution({ ...base, inviterIsActive: false }),
    ).toEqual({ ok: false, reason: "INVITER_INACTIVE" });
    expect(
      decideReferralAttribution({ ...base, alreadyAttributed: true }),
    ).toEqual({ ok: false, reason: "ALREADY_ATTRIBUTED" });
    expect(
      decideReferralAttribution({ ...base, isWithinEntryWindow: false }),
    ).toEqual({ ok: false, reason: "ENTRY_WINDOW_CLOSED" });
  });
});

describe("isReferralEntryWindowOpen", () => {
  const now = new Date("2026-08-18T12:00:00+09:00");
  const msPerDay = 24 * 60 * 60 * 1000;

  it("가입 미완료(completedAt 없음)면 닫힘", () => {
    expect(isReferralEntryWindowOpen(null, now)).toBe(false);
  });

  it("완료 직후와 창구 마지막 날까지는 열림", () => {
    expect(isReferralEntryWindowOpen(now, now)).toBe(true);
    const edge = new Date(
      now.getTime() - REFERRAL_ENTRY_WINDOW_DAYS * msPerDay,
    );
    expect(isReferralEntryWindowOpen(edge, now)).toBe(true);
  });

  it("창구를 하루라도 넘기면 닫힘", () => {
    const past = new Date(
      now.getTime() - (REFERRAL_ENTRY_WINDOW_DAYS + 1) * msPerDay,
    );
    expect(isReferralEntryWindowOpen(past, now)).toBe(false);
  });

  it("완료 시각이 미래여도(시계 오차) 관대하게 열림 처리", () => {
    const future = new Date(now.getTime() + msPerDay);
    expect(isReferralEntryWindowOpen(future, now)).toBe(true);
  });

  it("마감 시각은 완료 시각 + 창구 일수", async () => {
    const { referralEntryDeadline } = await import("./attribution");
    expect(referralEntryDeadline(now).getTime()).toBe(
      now.getTime() + REFERRAL_ENTRY_WINDOW_DAYS * msPerDay,
    );
  });
});

describe("kstMonthRange", () => {
  it("returns a non-empty month window", () => {
    const { start, end } = kstMonthRange(new Date("2026-08-15T12:00:00+09:00"));
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
