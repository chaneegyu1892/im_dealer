import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyReferralOnProfileComplete, type Db } from "./apply";

/** refereeId 유니크 위반(P2002) — 경합에서 진 쪽이 받는 오류 */
function refereeUniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`refereeId`)",
    { code: "P2002", clientVersion: "test", meta: { target: ["refereeId"] } },
  );
}

/** 쿠폰 code 유니크 위반 — referral 과 무관한 P2002 */
function codeUniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`code`)",
    { code: "P2002", clientVersion: "test", meta: { target: ["code"] } },
  );
}

const INVITER = { id: "inviter-1", isActive: true, kakaoId: "kakao-A" };

const POLICIES = [
  {
    id: "policy-given",
    trigger: "REFERRAL_GIVEN",
    title: "추천인 감사",
    rewardLabel: "1만원",
    rewardAmount: 10000,
    validDays: 30,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "policy-received",
    trigger: "REFERRAL_RECEIVED",
    title: "추천 혜택",
    rewardLabel: "5천원",
    rewardAmount: 5000,
    validDays: 30,
    startsAt: null,
    endsAt: null,
  },
];

function makeDb() {
  const mocks = {
    userFindUnique: vi.fn().mockResolvedValue(INVITER),
    referralFindUnique: vi.fn().mockResolvedValue(null),
    referralCount: vi.fn().mockResolvedValue(0),
    referralCreate: vi.fn().mockResolvedValue({ id: "ref-1" }),
    policyFindMany: vi.fn().mockResolvedValue(POLICIES),
    couponCreate: vi.fn().mockResolvedValue({ id: "coupon-1" }),
  };
  const db = {
    user: { findUnique: mocks.userFindUnique },
    referral: {
      findUnique: mocks.referralFindUnique,
      count: mocks.referralCount,
      create: mocks.referralCreate,
    },
    couponPolicy: { findMany: mocks.policyFindMany },
    issuedCoupon: { create: mocks.couponCreate },
  } as unknown as Db;
  return { db, mocks };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    inviteeUserId: "user-1",
    rawCode: "K4821",
    isWithinEntryWindow: true,
    inviteeKakaoId: "kakao-B",
    signupIpHash: null,
    ...overrides,
  };
}

describe("applyReferralOnProfileComplete", () => {
  let db: Db;
  let mocks: ReturnType<typeof makeDb>["mocks"];

  beforeEach(() => {
    ({ db, mocks } = makeDb());
  });

  it("정상 적용은 REWARDED 로 생성하고 양측에 쿠폰을 발급한다", async () => {
    const result = await applyReferralOnProfileComplete(input(), db);

    expect(result).toEqual({
      applied: true,
      inviterUserId: "inviter-1",
      referralId: "ref-1",
    });
    expect(mocks.referralCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referrerId: "inviter-1",
          refereeId: "user-1",
          status: "REWARDED",
        }),
      }),
    );
    expect(mocks.couponCreate).toHaveBeenCalledTimes(2);
  });

  it("동시 적용(경합) 시 정확히 1건만 인정되고 패자는 ALREADY_ATTRIBUTED 로 거절된다", async () => {
    // 조회는 둘 다 '없음'을 보지만, DB 유니크 가드로 생성은 1건만 성공한다.
    let createCalls = 0;
    mocks.referralCreate.mockImplementation(async () => {
      createCalls += 1;
      if (createCalls === 1) return { id: "ref-winner" };
      throw refereeUniqueViolation();
    });

    const [a, b] = await Promise.all([
      applyReferralOnProfileComplete(input(), db),
      applyReferralOnProfileComplete(input(), db),
    ]);
    const results = [a, b];

    const winners = results.filter((r) => r.applied);
    const losers = results.filter((r) => !r.applied);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toEqual({ applied: false, reason: "ALREADY_ATTRIBUTED" });
    // 패자는 쿠폰 발급 단계에 도달하지 않는다 — 부분 커밋 없음.
    expect(mocks.policyFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.couponCreate).toHaveBeenCalledTimes(2);
  });

  it("이미 Referral 행이 있으면 생성을 시도하지 않고 ALREADY_ATTRIBUTED", async () => {
    mocks.referralFindUnique.mockResolvedValue({ id: "existing-ref" });

    const result = await applyReferralOnProfileComplete(input(), db);

    expect(result).toEqual({ applied: false, reason: "ALREADY_ATTRIBUTED" });
    expect(mocks.referralCreate).not.toHaveBeenCalled();
    expect(mocks.couponCreate).not.toHaveBeenCalled();
  });

  it("자기 추천(동일 카카오 계정)은 BLOCKED 행으로 기록되고 쿠폰은 발급되지 않는다", async () => {
    const result = await applyReferralOnProfileComplete(
      input({ inviteeKakaoId: "kakao-A" }),
      db,
    );

    expect(result).toEqual({ applied: false, reason: "SELF_REFERRAL" });
    expect(mocks.referralCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referrerId: "inviter-1",
          refereeId: "user-1",
          status: "BLOCKED",
        }),
      }),
    );
    expect(mocks.policyFindMany).not.toHaveBeenCalled();
    expect(mocks.couponCreate).not.toHaveBeenCalled();
  });

  it("본인 코드 직접 입력(쿠키 경로 등)도 BLOCKED 로 기록된다", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      isActive: true,
      kakaoId: "kakao-C",
    });

    const result = await applyReferralOnProfileComplete(input(), db);

    expect(result).toEqual({ applied: false, reason: "SELF_REFERRAL" });
    expect(mocks.referralCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referrerId: "user-1",
          refereeId: "user-1",
          status: "BLOCKED",
        }),
      }),
    );
    expect(mocks.couponCreate).not.toHaveBeenCalled();
  });

  it("BLOCKED 행이 있으면 이후 재시도도 ALREADY_ATTRIBUTED 로 거절된다 (의도된 영구 차단)", async () => {
    mocks.referralFindUnique.mockResolvedValue({ id: "blocked-ref" });

    const result = await applyReferralOnProfileComplete(
      input({ rawCode: "B7777" }),
      db,
    );

    expect(result).toEqual({ applied: false, reason: "ALREADY_ATTRIBUTED" });
    expect(mocks.referralCreate).not.toHaveBeenCalled();
  });

  it("BLOCKED 기록 재시도에서 유니크 충돌이 나도 거절 결과는 유지된다", async () => {
    // 이미 차단 기록이 있는 어뷰저가 같은 자기 추천을 반복하는 경우.
    mocks.referralFindUnique.mockResolvedValue({ id: "blocked-ref" });
    mocks.referralCreate.mockRejectedValue(refereeUniqueViolation());

    const result = await applyReferralOnProfileComplete(
      input({ inviteeKakaoId: "kakao-A" }),
      db,
    );

    expect(result).toEqual({ applied: false, reason: "SELF_REFERRAL" });
  });

  it("refereeId 외 유니크 위반(쿠폰 code 등)은 그대로 throw 된다", async () => {
    mocks.referralCreate.mockRejectedValue(codeUniqueViolation());

    await expect(
      applyReferralOnProfileComplete(input(), db),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
