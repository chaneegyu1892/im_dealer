import { randomInt } from "crypto";

/**
 * 추천 코드: 대문자 알파벳 1 + 숫자 4 (예: K4821).
 * I/O 는 가독성 제외. 공간 24×10^4 = 24만.
 * 발급 난수는 CSPRNG(secureRandom) 고정 — 길이만 5자리로 환원했다.
 */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I/O 제외(가독성)
const DIGITS = "0123456789";

export const REFERRAL_CODE_PATTERN = /^[A-Z][0-9]{4}$/;

/** 발급 코드 자릿수: 알파벳 1 + 숫자 REFERRAL_CODE_DIGITS. */
const REFERRAL_CODE_DIGITS = 4;

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

/** Math.random 은 상태 추정으로 코드 예측이 가능하다 — CSPRNG 로만 발급한다. */
function secureRandom(): number {
  return randomInt(0, 2 ** 30) / 2 ** 30;
}

export function generateReferralCode(random: () => number = secureRandom): string {
  const letter = LETTERS[Math.floor(random() * LETTERS.length)] ?? "A";
  let digits = "";
  for (let i = 0; i < REFERRAL_CODE_DIGITS; i += 1) {
    digits += DIGITS[Math.floor(random() * DIGITS.length)] ?? "0";
  }
  return `${letter}${digits}`;
}
