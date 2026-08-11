import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPolicies: vi.fn(),
  findCoupons: vi.fn(),
  findConvertedQuote: vi.fn(),
  createManyCoupons: vi.fn(),
  updateManyCoupons: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    couponPolicy: { findMany: mocks.findPolicies },
    issuedCoupon: {
      findMany: mocks.findCoupons,
      createMany: mocks.createManyCoupons,
      updateMany: mocks.updateManyCoupons,
    },
    savedQuote: { findFirst: mocks.findConvertedQuote },
  },
}));

import { reconcileUserCoupons } from "./reconcile";

const TARGET = { id: "user-1", supabaseId: "sb-1", profileCompleted: true };

describe("reconcileUserCoupons", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.findPolicies.mockResolvedValue([]);
    mocks.findCoupons.mockResolvedValue([]);
    mocks.findConvertedQuote.mockResolvedValue(null);
    mocks.createManyCoupons.mockResolvedValue({ count: 0 });
    mocks.updateManyCoupons.mockResolvedValue({ count: 0 });
  });

  it("계약 조회는 supabaseId 로, 쿠폰 조회는 User.id 로 한다", async () => {
    await reconcileUserCoupons(TARGET);

    expect(mocks.findConvertedQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "sb-1", status: "CONVERTED", deletedAt: null },
      })
    );
    // 추천 보상 쿠폰(referralId != null)은 이 동기화의 관할 밖이다 — 피추천인의 계약에
    // 걸린 보상을 추천인 본인의 계약 여부로 승격·강등하면 안 된다.
    expect(mocks.findCoupons).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", referralId: null } })
    );
  });

  it("발급 대상이 있으면 skipDuplicates 로 생성한다", async () => {
    mocks.findPolicies.mockResolvedValue([
      {
        id: "policy-signup",
        trigger: "SIGNUP",
        title: "첫가입 축하 주유권",
        rewardLabel: "주유권 10만원",
        rewardAmount: 100_000,
        validDays: 90,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
    ]);

    await reconcileUserCoupons(TARGET);

    expect(mocks.createManyCoupons).toHaveBeenCalledTimes(1);
    const arg = mocks.createManyCoupons.mock.calls[0][0];
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data[0]).toMatchObject({
      userId: "user-1",
      policyId: "policy-signup",
      status: "HELD",
      titleSnapshot: "첫가입 축하 주유권",
      rewardAmountSnapshot: 100_000,
    });
    expect(arg.data[0].code).toMatch(/^AD-[A-Z2-9]{6}$/);
  });

  it("발급·전이 대상이 없으면 쓰기를 하지 않는다", async () => {
    await reconcileUserCoupons(TARGET);

    expect(mocks.createManyCoupons).not.toHaveBeenCalled();
    expect(mocks.updateManyCoupons).not.toHaveBeenCalled();
  });

  it("계약이 있으면 보유 중인 HELD 를 PENDING 으로 올린다", async () => {
    mocks.findConvertedQuote.mockResolvedValue({ id: "quote-9" });
    mocks.findCoupons.mockResolvedValue([
      { id: "coupon-1", policyId: "policy-signup", status: "HELD", expiresAt: null },
    ]);

    await reconcileUserCoupons(TARGET);

    // 계획이 세워질 당시 HELD 였던 쿠폰만 건드린다. 그 사이 다른 상태로 바뀌었으면
    // (예: 어드민이 PAID 처리) 이 쓰기가 손대면 안 된다.
    expect(mocks.updateManyCoupons).toHaveBeenCalledWith({
      where: { id: { in: ["coupon-1"] }, status: "HELD" },
      data: { status: "PENDING", qualifiedQuoteId: "quote-9", qualifiedAt: expect.any(Date) },
    });
  });

  it("계약이 철회되면 PENDING 을 HELD 로 되돌린다 (status: PENDING 조건 포함)", async () => {
    mocks.findConvertedQuote.mockResolvedValue(null);
    mocks.findCoupons.mockResolvedValue([
      { id: "coupon-2", policyId: "policy-contract", status: "PENDING", expiresAt: null },
    ]);

    await reconcileUserCoupons(TARGET);

    // reconcileUserCoupons 를 실제로 통과시켜 unqualify 쓰기가 발생하는지까지 확인한다.
    // status 예측만 검증하면 이 쓰기 경로 자체가 한 번도 실행되지 않아도 테스트가 통과한다.
    expect(mocks.updateManyCoupons).toHaveBeenCalledWith({
      where: { id: { in: ["coupon-2"] }, status: "PENDING" },
      data: { status: "HELD", qualifiedQuoteId: null, qualifiedAt: null },
    });
  });

  it("만료일이 지난 HELD 를 EXPIRED 로 바꾼다 (status: HELD 조건 포함)", async () => {
    mocks.findConvertedQuote.mockResolvedValue(null);
    mocks.findCoupons.mockResolvedValue([
      {
        id: "coupon-3",
        policyId: "policy-signup",
        status: "HELD",
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    ]);

    await reconcileUserCoupons(TARGET);

    // 위와 마찬가지로 expire 쓰기 경로가 실제로 호출되는지를 목 상태 조합으로 구동해 확인한다.
    expect(mocks.updateManyCoupons).toHaveBeenCalledWith({
      where: { id: { in: ["coupon-3"] }, status: "HELD" },
      data: { status: "EXPIRED" },
    });
  });

  it("전달받은 트랜잭션 클라이언트를 쓴다", async () => {
    const tx = {
      couponPolicy: { findMany: vi.fn().mockResolvedValue([]) },
      issuedCoupon: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
        updateMany: vi.fn(),
      },
      savedQuote: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    await reconcileUserCoupons(TARGET, tx as never);

    expect(tx.savedQuote.findFirst).toHaveBeenCalled();
    expect(mocks.findConvertedQuote).not.toHaveBeenCalled();
  });
});
