import type { Prisma, PrismaClient } from "@prisma/client";
import { generateCouponCode } from "@/lib/coupons/code";
import {
  decideReferralAttribution,
  kstMonthRange,
} from "./attribution";
import { normalizeReferralCode } from "./code";

type Db = PrismaClient | Prisma.TransactionClient;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ApplyReferralInput {
  inviteeUserId: string;
  rawCode: string | null | undefined;
  /** 인정 창구 안인지 — 최초 가입 완료 시점이거나 완료 후 창구(7일) 이내 */
  isWithinEntryWindow: boolean;
  inviteeKakaoId: string | null;
  signupIpHash?: string | null;
}

export type ApplyReferralResult =
  | { applied: true; inviterUserId: string; referralId: string }
  | { applied: false; reason: string };

/**
 * 가입 완료 시점에 추천 코드를 인정하고 쿠폰을 발급한다.
 * DB 모델: Referral(referrerId/refereeId) + CouponTrigger REFERRAL_GIVEN/RECEIVED
 */
export async function applyReferralOnProfileComplete(
  input: ApplyReferralInput,
  db: Db,
): Promise<ApplyReferralResult> {
  const code = normalizeReferralCode(input.rawCode);
  if (!code) {
    return { applied: false, reason: "INVALID_CODE" };
  }

  const inviter = await db.user.findUnique({
    where: { referralCode: code },
    select: {
      id: true,
      isActive: true,
      kakaoId: true,
    },
  });

  const already = await db.referral.findUnique({
    where: { refereeId: input.inviteeUserId },
    select: { id: true },
  });

  const { start, end } = kstMonthRange();
  const monthCount = inviter
    ? await db.referral.count({
        where: {
          referrerId: inviter.id,
          status: "REWARDED",
          createdAt: { gte: start, lt: end },
        },
      })
    : 0;

  const decision = decideReferralAttribution({
    inviteeUserId: input.inviteeUserId,
    inviterUserId: inviter?.id ?? null,
    inviterIsActive: inviter?.isActive ?? false,
    inviterKakaoId: inviter?.kakaoId ?? null,
    inviteeKakaoId: input.inviteeKakaoId,
    alreadyAttributed: Boolean(already),
    inviterMonthCount: monthCount,
    isWithinEntryWindow: input.isWithinEntryWindow,
    code,
  });

  if (!decision.ok) {
    return { applied: false, reason: decision.reason };
  }

  const referral = await db.referral.create({
    data: {
      referrerId: decision.inviterUserId,
      refereeId: input.inviteeUserId,
      code: decision.code,
      status: "REWARDED",
      signupIpHash: input.signupIpHash ?? null,
    },
    select: { id: true },
  });

  await issueReferralCoupons({
    referralId: referral.id,
    inviterUserId: decision.inviterUserId,
    inviteeUserId: input.inviteeUserId,
    now: new Date(),
    db,
  });

  return {
    applied: true,
    inviterUserId: decision.inviterUserId,
    referralId: referral.id,
  };
}

async function issueReferralCoupons(input: {
  referralId: string;
  inviterUserId: string;
  inviteeUserId: string;
  now: Date;
  db: Db;
}): Promise<void> {
  const policies = await input.db.couponPolicy.findMany({
    where: {
      isActive: true,
      trigger: { in: ["REFERRAL_GIVEN", "REFERRAL_RECEIVED"] },
    },
    select: {
      id: true,
      trigger: true,
      title: true,
      rewardLabel: true,
      rewardAmount: true,
      validDays: true,
      startsAt: true,
      endsAt: true,
    },
  });

  for (const policy of policies) {
    if (policy.startsAt && policy.startsAt.getTime() > input.now.getTime()) continue;
    if (policy.endsAt && policy.endsAt.getTime() <= input.now.getTime()) continue;

    const userId =
      policy.trigger === "REFERRAL_GIVEN"
        ? input.inviterUserId
        : input.inviteeUserId;

    const expiresAt =
      policy.validDays === null
        ? null
        : new Date(input.now.getTime() + policy.validDays * MS_PER_DAY);

    try {
      await input.db.issuedCoupon.create({
        data: {
          userId,
          policyId: policy.id,
          code: generateCouponCode(),
          status: "HELD",
          titleSnapshot: policy.title,
          rewardLabelSnapshot: policy.rewardLabel,
          rewardAmountSnapshot: policy.rewardAmount,
          expiresAt,
          referralId: input.referralId,
        },
      });
    } catch (error) {
      // partial unique (policyId, referralId) 충돌 = 이미 지급
      console.warn("[referral] coupon issue skipped:", error);
    }
  }
}
