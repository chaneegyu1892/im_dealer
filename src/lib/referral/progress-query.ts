import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildReferralProgressItem,
  type ReferralProgressItem,
  type ReferralQuoteSnapshot,
} from "./progress";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * referrer 의 REWARDED 추천 목록을 진행 단계 아이템으로 조립한다.
 * SavedQuote.userId 는 Prisma User.id 가 아니라 Supabase auth id 를 담으므로
 * 반드시 referee.supabaseId 로 견적을 매칭해야 한다. (탈퇴 회원은 supabaseId 가
 * null 이지만 탈퇴 시 Referral 행도 삭제되므로 방어적으로만 처리한다.)
 */
export async function loadReferralProgressItems(
  referrerUserId: string,
  db: Db,
): Promise<ReferralProgressItem[]> {
  const referrals = await db.referral.findMany({
    where: { referrerId: referrerUserId, status: "REWARDED" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      referee: {
        select: { name: true, supabaseId: true, profileCompletedAt: true },
      },
    },
  });

  const refereeSupabaseIds = referrals
    .map((r) => r.referee.supabaseId)
    .filter((id): id is string => Boolean(id));

  const quotes =
    refereeSupabaseIds.length === 0
      ? []
      : await db.savedQuote.findMany({
          where: { userId: { in: refereeSupabaseIds }, deletedAt: null },
          select: { userId: true, status: true, contactedAt: true },
        });

  const quotesByOwner = new Map<string, ReferralQuoteSnapshot[]>();
  for (const quote of quotes) {
    if (!quote.userId) continue;
    const list = quotesByOwner.get(quote.userId) ?? [];
    quotesByOwner.set(quote.userId, [
      ...list,
      { status: quote.status, contactedAt: quote.contactedAt },
    ]);
  }

  return referrals.map((referral) =>
    buildReferralProgressItem({
      id: referral.id,
      refereeName: referral.referee.name,
      // 사후 코드 입력이면 인정 시점(createdAt)이 실제 가입일보다 늦다. 가입일을 우선한다.
      signedUpAt: referral.referee.profileCompletedAt ?? referral.createdAt,
      quotes: referral.referee.supabaseId
        ? (quotesByOwner.get(referral.referee.supabaseId) ?? [])
        : [],
    }),
  );
}
