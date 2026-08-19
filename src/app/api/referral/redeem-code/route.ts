import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";
import {
  isReferralEntryWindowOpen,
  REFERRAL_ENTRY_WINDOW_DAYS,
} from "@/lib/referral/attribution";
import { applyReferralOnProfileComplete } from "@/lib/referral/apply";
import { normalizeReferralCode } from "@/lib/referral/code";
import { signupIpHashFromRequest } from "@/lib/referral/signup-ip";
import { checkRateLimit, referralRedeemRateLimit } from "@/lib/rate-limit";

// 가입 때 추천인 코드를 깜빡한 회원의 사후 입력 창구.
// 가입 완료 후 REFERRAL_ENTRY_WINDOW_DAYS 이내, 평생 1회(Referral.refereeId unique)만 인정된다.
const schema = z.object({
  code: z.string().trim().min(1, "추천인 코드를 입력해주세요.").max(10),
});

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, referralRedeemRateLimit, "referral-redeem");
  if (limited) return limited;

  const { user, error: authError } = await requireActiveUser();
  if (authError) return authError;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "추천인 코드를 입력해주세요." }, { status: 400 });
  }

  if (!user.profileCompleted) {
    return NextResponse.json({ error: "간편가입을 먼저 완료해주세요." }, { status: 400 });
  }
  if (!isReferralEntryWindowOpen(user.profileCompletedAt)) {
    return NextResponse.json(
      {
        error: `추천인 코드 입력 기간(가입 후 ${REFERRAL_ENTRY_WINDOW_DAYS}일)이 지났습니다.`,
      },
      { status: 400 },
    );
  }

  const code = normalizeReferralCode(parsed.data.code);
  if (!code) {
    return NextResponse.json(
      { error: "추천인 코드 형식이 올바르지 않습니다. (예: K4821)" },
      { status: 400 },
    );
  }

  try {
    const inviter = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true, isActive: true },
    });
    // 존재하지 않는 코드와 비활성 추천인은 같은 문구로 답해 코드 존재 여부를 노출하지 않는다.
    if (!inviter || !inviter.isActive) {
      console.warn("[redeem-code] rejected:", { userId: user.id, reason: "UNKNOWN_CODE" });
      return NextResponse.json(
        { error: "추천인 코드를 확인해주세요. 사용할 수 없는 코드입니다." },
        { status: 400 },
      );
    }
    if (inviter.id === user.id) {
      return NextResponse.json(
        { error: "본인의 추천 코드는 입력할 수 없습니다." },
        { status: 400 },
      );
    }

    // Referral 생성과 쿠폰 발급을 원자화 — 실패 시 전부 롤백돼 재시도가 깨끗하다.
    const result = await prisma.$transaction((tx) =>
      applyReferralOnProfileComplete(
        {
          inviteeUserId: user.id,
          rawCode: code,
          isWithinEntryWindow: true,
          inviteeKakaoId: user.kakaoId ?? null,
          signupIpHash: signupIpHashFromRequest(request),
        },
        tx,
      ),
    );

    if (!result.applied) {
      // 어뷰징 관찰용: 거절 사유는 로그에만 남기고 응답은 일반 문구로 통일한다.
      console.warn("[redeem-code] not applied:", { userId: user.id, reason: result.reason });
      if (result.reason === "ALREADY_ATTRIBUTED") {
        return NextResponse.json(
          { error: "이미 추천이 적용된 계정입니다." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "지금은 이 코드를 적용할 수 없습니다." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/referral/redeem-code]", err);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
