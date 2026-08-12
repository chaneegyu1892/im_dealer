import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type WithdrawingMember = Pick<User, "id" | "supabaseId">;

export interface LocalWithdrawalResult {
  auditLogId: string;
  deletedVerifications: number;
  anonymizedQuotes: number;
  unlinkedQuoteCalculations: number;
}

/**
 * 회원 PII를 한 트랜잭션에서 파기한다.
 *
 * 견적과 전송 이력은 상담/계약 운영 사실로 남기되 인증 주체와 연락처를 제거한다.
 * User 행은 FK 기반 운영·감사 이력을 보존하기 위한 비식별 tombstone으로 남긴다.
 * supabaseId/kakaoId를 비우므로 같은 카카오 계정의 재가입은 새 User 행을 만든다.
 */
export async function withdrawLocalMember(
  member: WithdrawingMember,
  kakaoUnlinked: boolean
): Promise<LocalWithdrawalResult> {
  if (!member.supabaseId) {
    throw new Error("WITHDRAWAL_REQUIRES_SUPABASE_ID");
  }
  const supabaseId = member.supabaseId;

  return prisma.$transaction(async (tx) => {
    const quoteIds = (
      await tx.savedQuote.findMany({
        where: { userId: supabaseId },
        select: { id: true },
      })
    ).map(({ id }) => id);

    if (quoteIds.length > 0) {
      await tx.reviewRequestToken.updateMany({
        where: { savedQuoteId: { in: quoteIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.review.updateMany({
        where: { savedQuoteId: { in: quoteIds } },
        data: { authorRealName: "탈퇴 회원" },
      });
    }

    const deletedVerifications = await tx.customerVerification.deleteMany({
      where: { userId: supabaseId },
    });
    const anonymizedQuotes = await tx.savedQuote.updateMany({
      where: { userId: supabaseId },
      data: {
        userId: null,
        customerName: null,
        phone: null,
        verificationCapabilityHash: null,
      },
    });
    const unlinkedQuoteCalculations = await tx.quoteCalcLog.updateMany({
      where: { userId: supabaseId },
      data: { userId: null },
    });

    await tx.issuedCoupon.deleteMany({ where: { userId: member.id } });
    await tx.referral.deleteMany({
      where: { OR: [{ referrerId: member.id }, { refereeId: member.id }] },
    });
    await tx.quoteDelivery.updateMany({
      where: { userId: member.id },
      data: { failReason: null, imageCleanupError: null },
    });
    await tx.adminAuditLog.updateMany({
      where: { actorId: member.id },
      data: {
        actorEmail: `withdrawn:${member.id}`,
        diff: Prisma.JsonNull,
        ip: null,
        userAgent: null,
      },
    });
    // 관리자가 이 회원을 대상으로 남긴 변경 diff에도 이름/이메일 등이 있을 수 있다.
    // 행의 action/resource/targetId는 보존하고 자유형 payload만 제거한다.
    await tx.adminAuditLog.updateMany({
      where: { targetId: member.id },
      data: { diff: Prisma.JsonNull },
    });

    await tx.user.update({
      where: { id: member.id },
      data: {
        supabaseId: null,
        email: null,
        passwordHash: null,
        name: "탈퇴 회원",
        role: "member",
        isActive: false,
        lastLoginAt: null,
        phone: null,
        provider: null,
        kakaoId: null,
        kakaoNickname: null,
        channelRelation: null,
        kakaoRefreshToken: null,
        marketingConsent: false,
        consentedAt: null,
        profileCompleted: false,
        referralCode: null,
      },
    });

    const auditLog = await tx.adminAuditLog.create({
      data: {
        actorId: member.id,
        actorEmail: `withdrawn:${member.id}`,
        action: "ACCOUNT_WITHDRAWN",
        resource: "User",
        targetId: member.id,
        diff: {
          kakaoUnlinked,
          supabaseAuthDeleted: false,
          verificationsDeleted: deletedVerifications.count,
          quotesAnonymized: anonymizedQuotes.count,
        },
      },
      select: { id: true },
    });

    return {
      auditLogId: auditLog.id,
      deletedVerifications: deletedVerifications.count,
      anonymizedQuotes: anonymizedQuotes.count,
      unlinkedQuoteCalculations: unlinkedQuoteCalculations.count,
    };
  });
}

export async function recordSupabaseDeletionOutcome(
  result: LocalWithdrawalResult,
  kakaoUnlinked: boolean,
  deleted: boolean,
  supabaseUserId: string
): Promise<void> {
  await prisma.adminAuditLog.update({
    where: { id: result.auditLogId },
    data: {
      diff: {
        kakaoUnlinked,
        supabaseAuthDeleted: deleted,
        ...(!deleted ? { pendingSupabaseUserId: supabaseUserId } : {}),
        verificationsDeleted: result.deletedVerifications,
        quotesAnonymized: result.anonymizedQuotes,
      },
    },
  });
}
