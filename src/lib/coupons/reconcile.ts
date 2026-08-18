import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateCouponCode } from "./code";
import {
  planCouponReconcile,
  type CouponStatusValue,
  type CouponTriggerValue,
  type CouponView,
  type PolicyView,
} from "./rules";

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
      select: {
        id: true,
        policyId: true,
        status: true,
        expiresAt: true,
        policy: { select: { trigger: true } },
        referral: { select: { referee: { select: { supabaseId: true } } } },
      },
    }),
    db.savedQuote.findFirst({
      where: { userId: target.supabaseId, status: "CONVERTED", deletedAt: null },
      orderBy: { convertedAt: "asc" },
      select: { id: true },
    }),
  ]);

  // 추천인 보상(REFERRAL_GIVEN)은 소유자 본인이 아니라 피추천인의 계약에 걸리므로,
  // 해당 쿠폰들이 연결된 피추천인의 계약 여부를 따로 조회한다.
  const refereeSupabaseIds = [
    ...new Set(
      coupons
        .filter((coupon) => coupon.policy.trigger === "REFERRAL_GIVEN")
        .map((coupon) => coupon.referral?.referee.supabaseId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const refereeConversions =
    refereeSupabaseIds.length === 0
      ? []
      : await db.savedQuote.findMany({
          where: {
            userId: { in: refereeSupabaseIds },
            status: "CONVERTED",
            deletedAt: null,
          },
          orderBy: { convertedAt: "asc" },
          select: { id: true, userId: true },
        });
  const firstConversionByReferee = new Map<string, string>();
  for (const quote of refereeConversions) {
    if (quote.userId && !firstConversionByReferee.has(quote.userId)) {
      firstConversionByReferee.set(quote.userId, quote.id);
    }
  }

  const couponViews: CouponView[] = coupons.map((coupon) => ({
    id: coupon.id,
    policyId: coupon.policyId,
    status: coupon.status as CouponStatusValue,
    expiresAt: coupon.expiresAt,
    trigger: coupon.policy.trigger as CouponTriggerValue,
    refereeConvertedQuoteId: coupon.referral?.referee.supabaseId
      ? (firstConversionByReferee.get(coupon.referral.referee.supabaseId) ?? null)
      : null,
  }));

  const now = new Date();
  const plan = planCouponReconcile({
    now,
    profileCompleted: target.profileCompleted,
    convertedQuoteId: convertedQuote?.id ?? null,
    policies: policies as PolicyView[],
    coupons: couponViews,
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
    // 쿠폰마다 자격 근거 견적이 다를 수 있다(본인 계약 vs 피추천인 계약).
    // 같은 견적끼리 묶어 updateMany 한다.
    const idsByQuote = new Map<string, string[]>();
    for (const item of plan.qualify) {
      idsByQuote.set(item.qualifiedQuoteId, [
        ...(idsByQuote.get(item.qualifiedQuoteId) ?? []),
        item.id,
      ]);
    }
    for (const [qualifiedQuoteId, ids] of idsByQuote) {
      await db.issuedCoupon.updateMany({
        where: { id: { in: ids }, status: "HELD" },
        data: {
          status: "PENDING",
          qualifiedQuoteId,
          qualifiedAt: now,
        },
      });
    }
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

/**
 * 계약(CONVERTED) 상태가 바뀐 견적의 소유 회원과, 그 회원을 추천한 추천인의
 * 쿠폰을 함께 동기화한다. 추천인 보상(REFERRAL_GIVEN)의 지급 조건이 피추천인
 * 계약에 걸려 있어, 소유자만 동기화하면 추천인 쿠폰이 회원 방문 전까지
 * 어드민 지급 대기 목록에 잡히지 않는다.
 */
export async function reconcileCouponsForQuoteOwner(
  quoteOwnerSupabaseId: string,
  db: CouponDb = prisma
): Promise<void> {
  const member = await db.user.findUnique({
    where: { supabaseId: quoteOwnerSupabaseId },
    select: { id: true, supabaseId: true, profileCompleted: true },
  });
  if (!member?.supabaseId) return;

  await reconcileUserCoupons(
    {
      id: member.id,
      supabaseId: member.supabaseId,
      profileCompleted: member.profileCompleted,
    },
    db
  );

  const referral = await db.referral.findUnique({
    where: { refereeId: member.id },
    select: {
      referrer: {
        select: { id: true, supabaseId: true, profileCompleted: true },
      },
    },
  });
  const referrer = referral?.referrer;
  if (!referrer?.supabaseId) return;

  await reconcileUserCoupons(
    {
      id: referrer.id,
      supabaseId: referrer.supabaseId,
      profileCompleted: referrer.profileCompleted,
    },
    db
  );
}
