import { prisma } from "@/lib/prisma";
import {
  collectVerificationCapabilities,
  hashVerificationCapability,
} from "@/lib/verification-capability";

/**
 * 로그인 성공 시 이 브라우저가 들고 있던 게스트 견적을 회원 계정에 귀속한다.
 *
 * 소유 증명은 capability 쿠키다 — 256비트 랜덤 값의 HttpOnly 쿠키를 든 브라우저만
 * DB 의 SHA-256 해시와 매칭된다. sessionId 자체(UUID, 클라이언트 상태)는 추측 가능성이
 * 있어 클레임 조건에 쓰지 않는다.
 *
 * 귀속 조건은 /api/verification/consent 의 원자적 클레임과 같다:
 * - userId: null → 이미 회원 소유인 행(타인 견적 포함)은 절대 건드리지 않는다.
 * - deletedAt: null / expiresAt > now → 삭제·만료 견적은 부활시키지 않는다.
 * 클레임 후 verificationCapabilityHash 를 지워 같은 쿠키로는 재클레임이 불가하게
 * 닫는다(재로그인 no-op, 멱등).
 *
 * best-effort 용도다 — 실패 시 예외를 던지며 호출부(auth/callback)는 로그인을 이어간다.
 */
export async function claimGuestSavedQuotes(
  cookieHeader: string | null,
  supabaseId: string,
): Promise<number> {
  const capabilities = collectVerificationCapabilities(cookieHeader);
  if (capabilities.length === 0) return 0;

  const result = await prisma.savedQuote.updateMany({
    where: {
      userId: null,
      deletedAt: null,
      expiresAt: { gt: new Date() },
      verificationCapabilityHash: { in: capabilities.map(hashVerificationCapability) },
    },
    data: {
      userId: supabaseId,
      verificationCapabilityHash: null,
    },
  });
  return result.count;
}
