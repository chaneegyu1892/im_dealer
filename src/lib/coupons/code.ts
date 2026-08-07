import { randomInt } from "node:crypto";

// 혼동하기 쉬운 I, O, 0, 1 을 뺀 32자 알파벳.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** 고객 안내·어드민 검색용 쿠폰 코드. 권한을 담지 않는 식별자다. */
export function generateCouponCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `AD-${code}`;
}
