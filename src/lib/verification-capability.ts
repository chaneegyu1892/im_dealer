import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_PREFIX = "imdealer_verify_";

export const VERIFICATION_CAPABILITY_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

/** 이 쿠키를 읽는 곳은 /api/quote/save(익명 재저장), /api/verification/*(동의·claim),
 * /auth/callback(로그인 시 게스트 견적 귀속) 세 갈래다. path 를 /api 에 한정하면
 * 브라우저가 /auth/callback 요청에 쿠키를 실어 보내지 않아(RFC 6265 path-match)
 * 로그인 클레임이 불가능하므로 루트로 심는다. HttpOnly 라 JS 노출은 없다. */
export const VERIFICATION_CAPABILITY_COOKIE_PATH = "/";

export function verificationCapabilityCookieName(sessionId: string): string {
  const sessionHash = createHash("sha256").update(sessionId).digest("hex");
  return `${COOKIE_PREFIX}${sessionHash.slice(0, 24)}`;
}

/** 원시 Cookie 헤더에서 이 브라우저가 들고 있는 검증 capability 값을 전부 수집한다.
 * 게스트 견적은 sessionId 마다 capability 쿠키가 하나씩 발급되므로 여러 개가 올 수 있다. */
export function collectVerificationCapabilities(cookieHeader: string | null): string[] {
  if (!cookieHeader) return [];
  const capabilities: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name.startsWith(COOKIE_PREFIX)) continue;
    const value = part.slice(separator + 1).trim();
    if (value) capabilities.push(value);
  }
  return capabilities;
}

export function createVerificationCapability(): string {
  return randomBytes(32).toString("base64url");
}

export function hashVerificationCapability(capability: string): string {
  return createHash("sha256").update(capability).digest("hex");
}

export function matchesVerificationCapability(
  expectedHash: string | null | undefined,
  capability: string | null | undefined
): boolean {
  if (!expectedHash || !capability || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return false;
  }

  const actualHash = hashVerificationCapability(capability);
  return timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(actualHash, "hex"));
}
