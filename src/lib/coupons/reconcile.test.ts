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
    expect(mocks.findCoupons).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
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

    expect(mocks.updateManyCoupons).toHaveBeenCalledWith({
      where: { id: { in: ["coupon-1"] } },
      data: { status: "PENDING", qualifiedQuoteId: "quote-9", qualifiedAt: expect.any(Date) },
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
