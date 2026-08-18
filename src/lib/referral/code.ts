import { randomInt } from "crypto";

/**
 * 추천 코드: 대문자 알파벳 1 + 숫자 6 (예: K482109).
 * 기존 발급분(알파벳 1 + 숫자 4)도 그대로 유효 — 두 형식 모두 조회·입력 가능.
 * I/O 는 가독성 제외. 신규 공간 24×10^6 = 2,400만 — 기존 24만 대비 열거 난이도 100배.
 */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I/O 제외(가독성)
const DIGITS = "0123456789";

export const REFERRAL_CODE_PATTERN = /^([A-Z][0-9]{4}|[A-Z][0-9]{6})$/;

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
  for (let i = 0; i < 6; i += 1) {
    digits += DIGITS[Math.floor(random() * DIGITS.length)] ?? "0";
  }
  return `${letter}${digits}`;
}
