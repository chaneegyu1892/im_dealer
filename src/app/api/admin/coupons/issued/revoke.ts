import type { CouponDb } from "@/lib/coupons/reconcile";

const REVOCABLE_STATUSES = ["PENDING", "PAID"] as const;

export type RevokeResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_status"; status: string };

/**
 * PENDING 또는 PAID 쿠폰을 REVOKED 로 되돌린다(지급 취소·회수).
 * updateMany 의 where 에 status 를 함께 넣어 동시 요청에서도 안전하게 처리한다.
 *
 * HELD/EXPIRED/REVOKED 는 취소 대상이 아니다:
 *  - HELD    : 아직 자격이 없는 상태라 자연 만료(or reconcile) 에 맡긴다.
 *  - EXPIRED : 이미 기간 만료로 종결.
 *  - REVOKED : 이미 취소됨.
 *
 * PAID → REVOKED 전이(이미 지급된 보상 회수)도 허용한다. paidAt/paidBy 는 그대로
 * 두고 revokedAt/revokeReason 으로 "언제 왜 회수했는지"를 별도로 기록한다.
 */
export async function revokeIssuedCoupon(
  couponId: string,
  adminId: string,
  reason: string | null,
  db: CouponDb
): Promise<RevokeResult> {
  const current = await db.issuedCoupon.findUnique({
    where: { id: couponId },
    select: { status: true },
  });

  if (!current) return { ok: false, reason: "not_found" };
  if (!REVOCABLE_STATUSES.includes(current.status as (typeof REVOCABLE_STATUSES)[number])) {
    return { ok: false, reason: "invalid_status", status: current.status };
  }

  const updated = await db.issuedCoupon.updateMany({
    where: { id: couponId, status: { in: [...REVOCABLE_STATUSES] } },
    data: { status: "REVOKED", revokedAt: new Date(), revokeReason: reason },
  });

  // 사전 조회 때는 취소 가능했지만 그 사이 reconcile 이 상태를 바꿨을 수 있다.
  if (updated.count === 0) {
    return { ok: false, reason: "invalid_status", status: current.status };
  }
  return { ok: true };
}
