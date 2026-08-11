export const REFERRAL_MONTHLY_CAP = 10;
export const REFERRAL_COOKIE_NAME = "referral_code";
export const REFERRAL_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30일

export type AttributionRejectReason =
  | "INVALID_CODE"
  | "SELF_REFERRAL"
  | "INVITER_INACTIVE"
  | "ALREADY_ATTRIBUTED"
  | "MONTHLY_CAP"
  | "NOT_NEW_PROFILE";

export interface AttributionDecisionInput {
  inviteeUserId: string;
  inviterUserId: string | null;
  inviterIsActive: boolean;
  inviterKakaoId: string | null;
  inviteeKakaoId: string | null;
  alreadyAttributed: boolean;
  /** 이번 달(KST) 추천인 성공 건수 */
  inviterMonthCount: number;
  /** 이번에 처음 profileCompleted 가 켜지는지 */
  isFirstProfileComplete: boolean;
  code: string | null;
}

export type AttributionDecision =
  | { ok: true; inviterUserId: string; code: string }
  | { ok: false; reason: AttributionRejectReason };

export function decideReferralAttribution(
  input: AttributionDecisionInput,
): AttributionDecision {
  if (!input.isFirstProfileComplete) {
    return { ok: false, reason: "NOT_NEW_PROFILE" };
  }
  if (!input.code) {
    return { ok: false, reason: "INVALID_CODE" };
  }
  if (!input.inviterUserId) {
    return { ok: false, reason: "INVALID_CODE" };
  }
  if (input.inviterUserId === input.inviteeUserId) {
    return { ok: false, reason: "SELF_REFERRAL" };
  }
  if (
    input.inviterKakaoId &&
    input.inviteeKakaoId &&
    input.inviterKakaoId === input.inviteeKakaoId
  ) {
    return { ok: false, reason: "SELF_REFERRAL" };
  }
  if (!input.inviterIsActive) {
    return { ok: false, reason: "INVITER_INACTIVE" };
  }
  if (input.alreadyAttributed) {
    return { ok: false, reason: "ALREADY_ATTRIBUTED" };
  }
  if (input.inviterMonthCount >= REFERRAL_MONTHLY_CAP) {
    return { ok: false, reason: "MONTHLY_CAP" };
  }
  return {
    ok: true,
    inviterUserId: input.inviterUserId,
    code: input.code,
  };
}

/** Asia/Seoul 기준 이번 달 시작·다음 달 시작 (UTC Date) */
export function kstMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  // KST = UTC+9
  const start = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0, 0));
  const end =
    month === 12
      ? new Date(Date.UTC(year + 1, 0, 1, -9, 0, 0, 0))
      : new Date(Date.UTC(year, month, 1, -9, 0, 0, 0));
  return { start, end };
}
