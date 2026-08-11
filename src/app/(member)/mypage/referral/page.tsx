import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/require-access";
import { prisma } from "@/lib/prisma";
import { ensureUserReferralCode } from "@/lib/referral/ensure-code";
import { kstMonthRange, REFERRAL_MONTHLY_CAP } from "@/lib/referral/attribution";
import { SITE_URL } from "@/lib/site-config";
import { ReferralClient } from "@/components/mypage/ReferralClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "추천인",
  description: "나만의 추천 링크와 코드로 친구를 초대하세요.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReferralPage() {
  const access = await requireMember();
  if (!access.userId) redirect("/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: access.userId },
    select: { id: true, name: true, referralCode: true },
  });
  if (!user) redirect("/login");

  const code = user.referralCode ?? (await ensureUserReferralCode(user.id, prisma));
  const { start, end } = kstMonthRange();
  const monthCount = await prisma.referral.count({
    where: {
      referrerId: user.id,
      status: "REWARDED",
      createdAt: { gte: start, lt: end },
    },
  });
  const totalCount = await prisma.referral.count({
    where: {
      referrerId: user.id,
      status: "REWARDED",
    },
  });

  const shareUrl = `${SITE_URL.replace(/\/$/, "")}/r/${code}`;

  return (
    <ReferralClient
      code={code}
      shareUrl={shareUrl}
      monthCount={monthCount}
      monthCap={REFERRAL_MONTHLY_CAP}
      totalCount={totalCount}
      memberName={user.name}
    />
  );
}
