import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: { updateMany: mocks.updateMany },
  },
}));

import { claimGuestSavedQuotes } from "./guest-quote-claim";
import {
  createVerificationCapability,
  hashVerificationCapability,
  verificationCapabilityCookieName,
} from "./verification-capability";

describe("claimGuestSavedQuotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 0 });
  });

  it("capability 쿠키 해시로 미귀속·미삭제·미만료 게스트 견적만 회원 계정에 귀속한다", async () => {
    const cap = createVerificationCapability();

    await claimGuestSavedQuotes(
      `${verificationCapabilityCookieName("guest-session")}=${cap}; unrelated=noise`,
      "supabase-member-1",
    );

    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        userId: null,
        deletedAt: null,
        expiresAt: { gt: expect.any(Date) },
        verificationCapabilityHash: { in: [hashVerificationCapability(cap)] },
      },
      // 클레임 후 해시를 지운다 — /api/verification/consent 의 원자적 클레임과 동일 패턴.
      data: { userId: "supabase-member-1", verificationCapabilityHash: null },
    });
  });

  it("검증 capability 쿠키가 없으면 DB 를 건드리지 않고 0 을 반환한다", async () => {
    await expect(claimGuestSavedQuotes("imd_nav=1; foo=bar", "supabase-member-1")).resolves.toBe(0);
    await expect(claimGuestSavedQuotes(null, "supabase-member-1")).resolves.toBe(0);
    await expect(claimGuestSavedQuotes("", "supabase-member-1")).resolves.toBe(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("빈 값이거나 깨진 쿠키 쌍은 capability 로 수집하지 않는다", async () => {
    const cap = createVerificationCapability();
    const header = [
      `${verificationCapabilityCookieName("empty")}=`,
      "imdealer_verify_broken-no-equals",
      `${verificationCapabilityCookieName("valid")}=${cap}`,
    ].join("; ");

    await claimGuestSavedQuotes(header, "supabase-member-1");

    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationCapabilityHash: { in: [hashVerificationCapability(cap)] },
        }),
      }),
    );
  });

  it("귀속된 행 수를 반환한다", async () => {
    mocks.updateMany.mockResolvedValue({ count: 3 });
    const cap = createVerificationCapability();

    await expect(
      claimGuestSavedQuotes(
        `${verificationCapabilityCookieName("guest-session")}=${cap}`,
        "supabase-member-1",
      ),
    ).resolves.toBe(3);
  });

  it("DB 실패 시 예외를 그대로 던져 호출부가 best-effort 로 처리하게 한다", async () => {
    mocks.updateMany.mockRejectedValue(new Error("db down"));
    const cap = createVerificationCapability();

    await expect(
      claimGuestSavedQuotes(
        `${verificationCapabilityCookieName("guest-session")}=${cap}`,
        "supabase-member-1",
      ),
    ).rejects.toThrow("db down");
  });
});
