/** 추천 코드: 대문자 알파벳 1 + 숫자 4 (예: K4821) */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // I/O 제외(가독성)
const DIGITS = "0123456789";

export const REFERRAL_CODE_PATTERN = /^[A-Z][0-9]{4}$/;

export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

export function generateReferralCode(random: () => number = Math.random): string {
  const letter = LETTERS[Math.floor(random() * LETTERS.length)] ?? "A";
  let digits = "";
  for (let i = 0; i < 4; i += 1) {
    digits += DIGITS[Math.floor(random() * DIGITS.length)] ?? "0";
  }
  return `${letter}${digits}`;
}
