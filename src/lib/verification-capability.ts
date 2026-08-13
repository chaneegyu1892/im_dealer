import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_PREFIX = "imdealer_verify_";

export const VERIFICATION_CAPABILITY_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

/** 이 쿠키를 읽는 곳은 /api/quote/save(익명 재저장)와 /api/verification/*(동의·claim) 두 갈래다.
 * path가 한쪽(/api/verification)에만 걸리면 익명 재저장이 403이 되므로 공통 상위 경로로 심는다. */
export const VERIFICATION_CAPABILITY_COOKIE_PATH = "/api";

export function verificationCapabilityCookieName(sessionId: string): string {
  const sessionHash = createHash("sha256").update(sessionId).digest("hex");
  return `${COOKIE_PREFIX}${sessionHash.slice(0, 24)}`;
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
