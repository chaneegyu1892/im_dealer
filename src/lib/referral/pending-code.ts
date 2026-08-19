import { normalizeReferralCode } from "./code";

/** 로그인 왕복 동안 랜딩 ?ref= 를 붙잡아 두는 키. 탭을 닫으면 사라진다. */
export const PENDING_REFERRAL_STORAGE_KEY = "imdealer:pending-referral-code";

/** 가입 후 코드를 직접 넣는 회원 표면 — 로그인 복귀 next 로 쓴다. */
export const REFERRAL_REDEEM_PATH = "/mypage/coupons";

/** /login?ref= 만 있고 next 가 없으면 쿠폰함 입력으로 보낸다. */
export function resolveReferralLoginNext(
  nextFromQuery: string,
  rawRef: string | null | undefined,
): { readonly next: string; readonly referralCode: string | null } {
  const referralCode = normalizeReferralCode(rawRef);
  const next =
    nextFromQuery === "/" && referralCode ? REFERRAL_REDEEM_PATH : nextFromQuery;
  return { next, referralCode };
}

export function persistPendingReferralCode(
  raw: string | null | undefined,
): string | null {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  if (typeof window === "undefined") return code;
  try {
    window.sessionStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, code);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
  }
  return code;
}

export function readPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeReferralCode(
      window.sessionStorage.getItem(PENDING_REFERRAL_STORAGE_KEY),
    );
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
}
