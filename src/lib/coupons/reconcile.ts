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
    // 추천인 보상 쿠폰(referralId != null)은 이 동기화의 관할이 아니다.
    // 여기 계획은 "이 회원의 계약"만 보고 세워지는데, 추천인이 받은 REFERRAL_GIVEN 은
    // 피추천인의 계약에 걸린 보상이다. 함께 읽으면 추천인 본인 계약 여부에 따라
    // qualify/unqualify 로 잘못 승격·강등되고, 만료 스윕까지 끌려간다.
    // 추천 쿠폰은 귀속 트랜잭션이 HELD 로 만들고 어드민이 지급을 결정한다.
    db.issuedCoupon.findMany({
      where: { userId: target.id, referralId: null },
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

  // 계획은 스냅샷 읽기 시점의 상태로 세워진다. 그 사이 어드민이 지급 처리를 했을 수
  // 있으므로, 쓰기마다 계획이 가정한 상태를 조건절에 명시해 다른 상태(특히 PAID)를
  // 덮어쓰지 않게 한다.
  if (plan.qualify.length > 0) {
    await db.issuedCoupon.updateMany({
      where: { id: { in: plan.qualify }, status: "HELD" },
      data: {
        status: "PENDING",
        qualifiedQuoteId: convertedQuote?.id ?? null,
        qualifiedAt: now,
      },
    });
  }

  if (plan.unqualify.length > 0) {
    await db.issuedCoupon.updateMany({
      where: { id: { in: plan.unqualify }, status: "PENDING" },
      data: { status: "HELD", qualifiedQuoteId: null, qualifiedAt: null },
    });
  }

  if (plan.expire.length > 0) {
    await db.issuedCoupon.updateMany({
      where: { id: { in: plan.expire }, status: "HELD" },
      data: { status: "EXPIRED" },
    });
  }
}
