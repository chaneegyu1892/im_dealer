import { ReferralStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildReferralLink } from "@/lib/referral/code";
import { ensureReferralCode } from "@/lib/referral/ensure-code";
import { MONTHLY_REWARD_CAP } from "@/lib/referral/attribute";

export interface ReferralPageData {
  code: string;
  link: string;
  /** 이번 달(달력 기준) 보상 확정 추천 수. */
  monthlyCount: number;
  remainingQuota: number;
}

/** 달력 기준 이번 달 1일 00:00(서버 로컬 시간). 월 한도의 기준점. */
function startOfCalendarMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * 추천인 페이지 SSR 데이터. 코드는 lazy-생성(멱등), 이번 달 보상 추천 수는
 * 달력 기준으로 센다. `supabaseId` 로 회원을 찾아 Prisma User.id 를 구한다.
 */
export async function getReferralPageData(supabaseId: string): Promise<ReferralPageData> {
  const member = await prisma.user.findUnique({
    where: { supabaseId },
    select: { id: true, supabaseId: true, referralCode: true },
  });
  if (!member) {
    return { code: "", link: "", monthlyCount: 0, remainingQuota: MONTHLY_REWARD_CAP };
  }

  const code = await ensureReferralCode({
    id: member.id,
    referralCode: member.referralCode,
  });

  const monthlyCount = await prisma.referral.count({
    where: {
      referrerId: member.id,
      status: ReferralStatus.REWARDED,
      createdAt: { gte: startOfCalendarMonth() },
    },
  });

  return {
    code,
    link: buildReferralLink(code),
    monthlyCount,
    remainingQuota: Math.max(0, MONTHLY_REWARD_CAP - monthlyCount),
  };
}
