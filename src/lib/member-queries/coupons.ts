import { prisma } from "@/lib/prisma";
import {
  reconcileUserCoupons,
  type CouponReconcileTarget,
} from "@/lib/coupons/reconcile";
import type { CouponStatusValue } from "@/lib/coupons/rules";

export interface CouponBoxItem {
  id: string;
  code: string;
  status: CouponStatusValue;
  title: string;
  description: string | null;
  rewardLabel: string;
  rewardAmount: number | null;
  rewardKind: string;
  termsNote: string | null;
  expiresAt: Date | null;
  paidAt: Date | null;
}

export interface CouponBoxSummary {
  heldCount: number;
  pendingCount: number;
  /** 보유 + 지급예정 쿠폰의 금액 합. 계약 완료 시 받을 금액이다. */
  totalAmount: number;
}

export interface CouponBoxData {
  available: CouponBoxItem[];
  past: CouponBoxItem[];
  summary: CouponBoxSummary;
}

// 세 곳에서 참조로 반환되는 공유 상수다. 얼려두지 않으면 호출자가 한 번만 변형해도
// 이후 모든 "쿠폰 없음" 응답이 오염된다.
const EMPTY_SUMMARY: CouponBoxSummary = Object.freeze({
  heldCount: 0,
  pendingCount: 0,
  totalAmount: 0,
});

const AVAILABLE_STATUSES: ReadonlySet<CouponStatusValue> = new Set<CouponStatusValue>([
  "PENDING",
  "HELD",
]);

// 사용 가능 목록에서 PENDING 을 항상 먼저 보여준다.
const AVAILABLE_ORDER: Record<string, number> = { PENDING: 0, HELD: 1 };

/** 동기화 실패가 화면 렌더를 막지 않는다. 다음 진입 때 다시 맞춘다. */
async function safeReconcile(target: CouponReconcileTarget): Promise<void> {
  try {
    await reconcileUserCoupons(target);
  } catch (error) {
    console.error("[coupons] reconcileUserCoupons 실패:", error);
  }
}

function toSummary(items: readonly CouponBoxItem[]): CouponBoxSummary {
  return items.reduce<CouponBoxSummary>(
    (acc, item) => ({
      heldCount: acc.heldCount + (item.status === "HELD" ? 1 : 0),
      pendingCount: acc.pendingCount + (item.status === "PENDING" ? 1 : 0),
      totalAmount: acc.totalAmount + (item.rewardAmount ?? 0),
    }),
    EMPTY_SUMMARY
  );
}

export async function getCouponBoxData(supabaseId: string): Promise<CouponBoxData> {
  const member = await prisma.user.findUnique({
    where: { supabaseId },
    select: { id: true, supabaseId: true, profileCompleted: true },
  });

  if (!member?.supabaseId) {
    return { available: [], past: [], summary: EMPTY_SUMMARY };
  }

  const target: CouponReconcileTarget = {
    id: member.id,
    supabaseId: member.supabaseId,
    profileCompleted: member.profileCompleted,
  };
  await safeReconcile(target);

  const rows = await prisma.issuedCoupon.findMany({
    where: { userId: member.id },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      code: true,
      status: true,
      titleSnapshot: true,
      rewardLabelSnapshot: true,
      rewardAmountSnapshot: true,
      expiresAt: true,
      paidAt: true,
      policy: { select: { description: true, rewardKind: true, termsNote: true } },
    },
  });

  const items: CouponBoxItem[] = rows.map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status as CouponStatusValue,
    title: row.titleSnapshot,
    description: row.policy.description,
    rewardLabel: row.rewardLabelSnapshot,
    rewardAmount: row.rewardAmountSnapshot,
    rewardKind: row.policy.rewardKind,
    termsNote: row.policy.termsNote,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
  }));

  const available = items
    .filter((item) => AVAILABLE_STATUSES.has(item.status))
    .sort((a, b) => (AVAILABLE_ORDER[a.status] ?? 9) - (AVAILABLE_ORDER[b.status] ?? 9));
  const past = items.filter((item) => !AVAILABLE_STATUSES.has(item.status));

  return { available, past, summary: toSummary(available) };
}

/** 마이페이지 메인의 요약 카드용. 목록을 만들지 않고 집계만 한다. */
export async function getCouponSummary(
  target: CouponReconcileTarget
): Promise<CouponBoxSummary> {
  await safeReconcile(target);

  const rows = await prisma.issuedCoupon.findMany({
    where: { userId: target.id, status: { in: ["HELD", "PENDING"] } },
    select: { status: true, rewardAmountSnapshot: true },
  });

  return rows.reduce<CouponBoxSummary>(
    (acc, row) => ({
      heldCount: acc.heldCount + (row.status === "HELD" ? 1 : 0),
      pendingCount: acc.pendingCount + (row.status === "PENDING" ? 1 : 0),
      totalAmount: acc.totalAmount + (row.rewardAmountSnapshot ?? 0),
    }),
    EMPTY_SUMMARY
  );
}
