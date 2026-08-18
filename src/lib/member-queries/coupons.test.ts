import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMember: vi.fn(),
  findCoupons: vi.fn(),
  reconcile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findMember },
    issuedCoupon: { findMany: mocks.findCoupons },
  },
}));

vi.mock("@/lib/coupons/reconcile", () => ({
  reconcileUserCoupons: mocks.reconcile,
}));

import { getCouponBoxData, getCouponSummary } from "./coupons";

const MEMBER = { id: "user-1", supabaseId: "sb-1", profileCompleted: true };

function coupon(overrides: Record<string, unknown> = {}) {
  return {
    id: "coupon-1",
    code: "AD-8F3K2A",
    status: "HELD",
    titleSnapshot: "첫가입 축하 주유권",
    rewardLabelSnapshot: "주유권 10만원",
    rewardAmountSnapshot: 100_000,
    expiresAt: null,
    paidAt: null,
    policy: { description: "계약을 완료하면 지급돼요", rewardKind: "FUEL", termsNote: "안내" },
    ...overrides,
  };
}

describe("getCouponBoxData", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.findMember.mockResolvedValue(MEMBER);
    mocks.findCoupons.mockResolvedValue([]);
    mocks.reconcile.mockResolvedValue(undefined);
  });

  it("조회 전에 쿠폰을 동기화한다", async () => {
    await getCouponBoxData("sb-1");
    expect(mocks.reconcile).toHaveBeenCalledWith(MEMBER);
  });

  it("본인 User.id 로만 쿠폰을 조회한다", async () => {
    await getCouponBoxData("sb-1");

    expect(mocks.findCoupons).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("동기화가 실패해도 목록 조회는 계속한다", async () => {
    mocks.reconcile.mockRejectedValue(new Error("boom"));
    mocks.findCoupons.mockResolvedValue([coupon()]);

    const data = await getCouponBoxData("sb-1");

    expect(data.available).toHaveLength(1);
  });

  it("HELD 를 PENDING 보다 앞에 둔다", async () => {
    mocks.findCoupons.mockResolvedValue([
      coupon({ id: "pending", status: "PENDING" }),
      coupon({ id: "held", status: "HELD" }),
    ]);

    const data = await getCouponBoxData("sb-1");

    expect(data.available.map((item) => item.id)).toEqual(["held", "pending"]);
  });

  it("지급 완료·만료·취소는 지난 쿠폰으로 분류한다", async () => {
    mocks.findCoupons.mockResolvedValue([
      coupon({ id: "paid", status: "PAID" }),
      coupon({ id: "expired", status: "EXPIRED" }),
      coupon({ id: "revoked", status: "REVOKED" }),
      coupon({ id: "held", status: "HELD" }),
    ]);

    const data = await getCouponBoxData("sb-1");

    expect(data.past.map((item) => item.id).sort()).toEqual(["expired", "paid", "revoked"]);
    expect(data.available.map((item) => item.id)).toEqual(["held"]);
  });

  it("요약은 보유·지급예정 장수와 두 상태의 금액 합을 낸다", async () => {
    mocks.findCoupons.mockResolvedValue([
      coupon({ id: "held", status: "HELD", rewardAmountSnapshot: 100_000 }),
      coupon({ id: "pending", status: "PENDING", rewardAmountSnapshot: 300_000 }),
      coupon({ id: "paid", status: "PAID", rewardAmountSnapshot: 50_000 }),
    ]);

    const data = await getCouponBoxData("sb-1");

    expect(data.summary).toEqual({ heldCount: 1, pendingCount: 1, totalAmount: 400_000 });
  });

  it("금액이 없는 쿠폰은 합계에서 0으로 센다", async () => {
    mocks.findCoupons.mockResolvedValue([
      coupon({ id: "held", status: "HELD", rewardAmountSnapshot: null }),
    ]);

    const data = await getCouponBoxData("sb-1");

    expect(data.summary.totalAmount).toBe(0);
  });

  it("회원 행이 없으면 빈 쿠폰함을 돌려준다", async () => {
    mocks.findMember.mockResolvedValue(null);

    const data = await getCouponBoxData("sb-unknown");

    expect(data).toEqual({
      available: [],
      past: [],
      summary: { heldCount: 0, pendingCount: 0, totalAmount: 0 },
    });
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });

  it("빈 요약은 호출자가 변형할 수 없다", async () => {
    mocks.findMember.mockResolvedValue(null);

    const data = await getCouponBoxData("sb-unknown");

    expect(Object.isFrozen(data.summary)).toBe(true);
  });
});

describe("getCouponSummary", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.findCoupons.mockResolvedValue([]);
    mocks.reconcile.mockResolvedValue(undefined);
  });

  it("조회 전에 쿠폰을 동기화한다", async () => {
    await getCouponSummary(MEMBER);

    expect(mocks.reconcile).toHaveBeenCalledWith(MEMBER);
  });

  it("본인 User.id 의 보유·지급예정 쿠폰만 집계한다", async () => {
    mocks.findCoupons.mockResolvedValue([
      { status: "HELD", rewardAmountSnapshot: 100_000 },
      { status: "PENDING", rewardAmountSnapshot: 300_000 },
    ]);

    const summary = await getCouponSummary(MEMBER);

    expect(mocks.findCoupons).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", status: { in: ["HELD", "PENDING"] } },
      })
    );
    expect(summary).toEqual({ heldCount: 1, pendingCount: 1, totalAmount: 400_000 });
  });

  it("금액이 없는 쿠폰은 합계에서 0으로 센다", async () => {
    mocks.findCoupons.mockResolvedValue([{ status: "HELD", rewardAmountSnapshot: null }]);

    const summary = await getCouponSummary(MEMBER);

    expect(summary.totalAmount).toBe(0);
  });

  it("동기화가 실패해도 집계는 계속한다", async () => {
    mocks.reconcile.mockRejectedValue(new Error("boom"));
    mocks.findCoupons.mockResolvedValue([{ status: "PENDING", rewardAmountSnapshot: 50_000 }]);

    const summary = await getCouponSummary(MEMBER);

    expect(summary).toEqual({ heldCount: 0, pendingCount: 1, totalAmount: 50_000 });
  });
});
