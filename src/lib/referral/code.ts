import { randomInt } from "node:crypto";

// 숫자와 붙여 읽을 때 오독되는 I, O 를 뺀 24자.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGIT_COUNT = 4;

/** 추천 링크·수동 입력 코드의 형식. 캡처 라우트·수동 입력 검증이 공유한다. */
export const REFERRAL_CODE_REGEX = /^[A-Z][0-9]{4}$/;

/**
 * 알파벳 1자 + 숫자 4자(예: "A1234"). 권한을 담지 않는 식별자다.
 * 반드시 서버에서만 생성한다 — 클라이언트 생성 값은 신뢰하지 않는다.
 */
export function generateReferralCode(): string {
  let code = LETTERS[randomInt(LETTERS.length)];
  for (let i = 0; i < DIGIT_COUNT; i += 1) {
    code += String(randomInt(10));
  }
  return code;
}

/** 공유용 추천 링크. 환경변수 미설정 시 상대 경로로 떨어진다. */
export function buildReferralLink(code: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/r/${code}`;
}
