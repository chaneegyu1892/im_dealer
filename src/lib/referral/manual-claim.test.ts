import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueReferral: vi.fn(),
  attributeReferral: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    referral: { findUnique: mocks.findUniqueReferral },
    $transaction: (callback: (tx: unknown) => unknown) => callback({}),
  },
}));

vi.mock("./attribute", () => ({
  // 도우미 자체가 가드를 판정하는 게 테스트 대상 — 실제 속성 로직은 여기서 갈음한다.
  attributeReferral: mocks.attributeReferral,
}));

import { manualReferralClaim } from "./manual-claim";

const NOW = new Date("2026-08-11T04:00:00.000Z");

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    kakaoId: "kakao-1",
    phone: "010-1111-2222",
    email: "member@example.com",
    supabaseId: "supabase-1",
    createdAt: new Date("2026-08-09T04:00:00.000Z"), // 2일 전 — 7일 이내
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUniqueReferral.mockResolvedValue(null);
  mocks.attributeReferral.mockResolvedValue({ status: "REWARDED", referralId: "ref-1" });
});

describe("manualReferralClaim", () => {
  it("코드 미제출이면 noop — DB 나 attributeReferral 을 건드리지 않는다", async () => {
    const result = await manualReferralClaim({ user: user(), referralCode: "", now: NOW });

    expect(result).toEqual({ precheck: "noop" });
    expect(mocks.findUniqueReferral).not.toHaveBeenCalled();
    expect(mocks.attributeReferral).not.toHaveBeenCalled();
  });

  it("형식이 깨진 코드면 rejected(invalid_code)", async () => {
    const result = await manualReferralClaim({ user: user(), referralCode: "notacode", now: NOW });

    expect(result).toEqual({ precheck: "rejected", rejection: "invalid_code" });
    expect(mocks.findUniqueReferral).not.toHaveBeenCalled();
    expect(mocks.attributeReferral).not.toHaveBeenCalled();
  });

  it("이미 귀속된 회원이면 rejected(already_attributed)", async () => {
    mocks.findUniqueReferral.mockResolvedValue({ id: "referral-existing" });

    const result = await manualReferralClaim({
      user: user(),
      referralCode: "A1234",
      now: NOW,
    });

    expect(result).toEqual({ precheck: "rejected", rejection: "already_attributed" });
    expect(mocks.findUniqueReferral).toHaveBeenCalledWith({
      where: { refereeId: "user-1" },
      select: { id: true },
    });
    expect(mocks.attributeReferral).not.toHaveBeenCalled();
  });

  it("계정 생성 후 7일이 지났으면 rejected(expired)", async () => {
    const result = await manualReferralClaim({
      user: user({ createdAt: new Date("2026-08-04T04:00:00.000Z") }), // 정확히 7일 전
      referralCode: "A1234",
      now: NOW,
    });

    expect(result).toEqual({ precheck: "rejected", rejection: "expired" });
    expect(mocks.attributeReferral).not.toHaveBeenCalled();
  });

  it("7일 미만이면 attributeReferral 로 넘긴다 — 자기추천 판정도 귀속된다", async () => {
    mocks.attributeReferral.mockResolvedValue({ status: "BLOCKED", reason: "self_referral" });

    const result = await manualReferralClaim({
      user: user(),
      referralCode: "a1234", // 소문자 → 대문자로 정규화되어 전달된다
      now: NOW,
    });

    expect(result).toEqual({
      precheck: "ok",
      attribution: { status: "BLOCKED", reason: "self_referral" },
    });
    expect(mocks.attributeReferral).toHaveBeenCalledWith(
      expect.objectContaining({
        referralCode: "A1234",
        refereeUser: expect.objectContaining({
          id: "user-1",
          kakaoId: "kakao-1",
          phone: "010-1111-2222",
          email: "member@example.com",
          supabaseId: "supabase-1",
        }),
        now: NOW,
      })
    );
  });

  it("정상 코드는 REWARDED 결과를 그대로 돌려준다", async () => {
    const result = await manualReferralClaim({
      user: user(),
      referralCode: "A1234",
      now: NOW,
    });

    expect(result).toEqual({
      precheck: "ok",
      attribution: { status: "REWARDED", referralId: "ref-1" },
    });
  });
});
