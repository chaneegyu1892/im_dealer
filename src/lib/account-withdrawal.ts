import { Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type WithdrawingMember = Pick<User, "id" | "supabaseId">;

export const KAKAO_UNLINK_AUDIT_ACTION = "ACCOUNT_WITHDRAWAL_KAKAO_UNLINKED";

export interface LocalWithdrawalResult {
  auditLogId: string;
  deletedVerifications: number;
  anonymizedQuotes: number;
  unlinkedQuoteCalculations: number;
}

/** 이전 시도에서 카카오 unlink 가 커밋됐는지. 로컬 파기 재시도의 멱등 가드. */
export async function hasKakaoUnlinkedForWithdrawal(userId: string): Promise<boolean> {
  const row = await prisma.adminAuditLog.findFirst({
    where: { actorId: userId, action: KAKAO_UNLINK_AUDIT_ACTION },
    select: { id: true },
  });
  return Boolean(row);
}

/** unlink 직후, 로컬 파기 전에 남겨 재시도가 카카오를 다시 요구하지 않게 한다. */
export async function markKakaoUnlinkedForWithdrawal(userId: string): Promise<void> {
  const already = await hasKakaoUnlinkedForWithdrawal(userId);
  if (already) return;
  await prisma.adminAuditLog.create({
    data: {
      actorId: userId,
      actorEmail: `pending-withdrawal:${userId}`,
      action: KAKAO_UNLINK_AUDIT_ACTION,
      resource: "User",
      targetId: userId,
      diff: { kakaoUnlinked: true },
    },
  });
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

    // 탈퇴 회원 본인 쿠폰·추천 슬롯만 지운다. 상대방 REWARDED 행/쿠폰은 남긴다.
    // 피추천인 탈퇴: 추천인 IssuedCoupon(REFERRAL_GIVEN) 은 userId 가 추천인이라 삭제하지 않는다.
    //   Referral 행은 지워지고 IssuedCoupon.referralId 는 onDelete: SetNull.
    //   이미 지급(PAID)된 추천인 쿠폰을 회수하지 않는다.
    // 추천인 탈퇴: 피추천인 IssuedCoupon(REFERRAL_RECEIVED) 은 피추천인 userId 라 남고,
    //   추천인 본인 쿠폰만 deleteMany 된다. 지급 완료분도 본인 행이므로 함께 삭제(본인 PII 파기).
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
