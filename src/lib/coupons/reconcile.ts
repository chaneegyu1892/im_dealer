import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateCouponCode } from "./code";
import { planCouponReconcile, type CouponView, type PolicyView } from "./rules";

export type CouponDb = PrismaClient | Prisma.TransactionClient;

export interface CouponReconcileTarget {
  /** Prisma User.id — IssuedCoupon.userId 가 참조하는 값 */
  id: string;
  /** Supabase auth user id — SavedQuote.userId 가 참조하는 값 */
  supabaseId: string;
  profileCompleted: boolean;
}

/**
 * 회원 한 명의 쿠폰 상태를 정책과 계약 현황에 맞춘다.
 * 멱등하므로 몇 번 호출해도 결과가 같다. 트랜잭션을 열지 않는 이유도 그 때문이다.
 */
export async function reconcileUserCoupons(
  target: CouponReconcileTarget,
  db: CouponDb = prisma
): Promise<void> {
  const [policies, coupons, convertedQuote] = await Promise.all([
    db.couponPolicy.findMany({
      select: {
        id: true,
        trigger: true,
        title: true,
        rewardLabel: true,
        rewardAmount: true,
        validDays: true,
        isActive: true,
        startsAt: true,
        endsAt: true,
      },
    }),
    db.issuedCoupon.findMany({
      where: { userId: target.id },
      select: { id: true, policyId: true, status: true, expiresAt: true },
    }),
    db.savedQuote.findFirst({
      where: { userId: target.supabaseId, status: "CONVERTED", deletedAt: null },
      orderBy: { convertedAt: "asc" },
      select: { id: true },
    }),
  ]);

  const now = new Date();
  const plan = planCouponReconcile({
    now,
    profileCompleted: target.profileCompleted,
    convertedQuoteId: convertedQuote?.id ?? null,
    policies: policies as PolicyView[],
    coupons: coupons as CouponView[],
  });

  if (plan.issue.length > 0) {
    await db.issuedCoupon.createMany({
      data: plan.issue.map((item) => ({
        userId: target.id,
        policyId: item.policyId,
        code: generateCouponCode(),
        status: item.status,
        titleSnapshot: item.titleSnapshot,
        rewardLabelSnapshot: item.rewardLabelSnapshot,
        rewardAmountSnapshot: item.rewardAmountSnapshot,
        expiresAt: item.expiresAt,
        qualifiedQuoteId: item.qualifiedQuoteId,
        qualifiedAt: item.qualifiedQuoteId ? now : null,
      })),
      skipDuplicates: true,
    });
  }

  if (plan.qualify.length > 0) {
    await db.issuedCoupon.updateMany({
      where: { id: { in: plan.qualify } },
      data: {
        status: "PENDING",
        qualifiedQuoteId: convertedQuote?.id ?? null,
        qualifiedAt: now,
      },
    });
  }

  if (plan.unqualify.length > 0) {
    await db.issuedCoupon.updateMany({
      where: { id: { in: plan.unqualify } },
      data: { status: "HELD", qualifiedQuoteId: null, qualifiedAt: null },
    });
  }

  if (plan.expire.length > 0) {
    await db.issuedCoupon.updateMany({
      where: { id: { in: plan.expire } },
      data: { status: "EXPIRED" },
    });
  }
}
