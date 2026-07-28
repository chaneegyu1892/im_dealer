import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_PREFIX = "imdealer_verify_";

export const VERIFICATION_CAPABILITY_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

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
