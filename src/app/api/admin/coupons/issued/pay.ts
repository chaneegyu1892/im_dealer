import type { CouponDb } from "@/lib/coupons/reconcile";

export type PayResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_status"; status: string };

/**
 * PENDING 쿠폰만 PAID 로 바꾼다.
 * updateMany 의 where 에 status 를 함께 넣어 동시 요청에서도 두 번 지급되지 않게 한다.
 */
export async function payIssuedCoupon(
  couponId: string,
  adminId: string,
  memo: string | null,
  db: CouponDb
): Promise<PayResult> {
  const current = await db.issuedCoupon.findUnique({
    where: { id: couponId },
    select: { status: true },
  });

  if (!current) return { ok: false, reason: "not_found" };
  if (current.status !== "PENDING") {
    return { ok: false, reason: "invalid_status", status: current.status };
  }

  const updated = await db.issuedCoupon.updateMany({
    where: { id: couponId, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date(), paidBy: adminId, paidMemo: memo },
  });

  if (updated.count === 0) {
    return { ok: false, reason: "invalid_status", status: current.status };
  }
  return { ok: true };
}
