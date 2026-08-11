import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/admin-auth";
import { toDomesticKR } from "@/lib/phone";
import { REFERRAL_COOKIE_NAME } from "@/lib/referral/attribution";
import { applyReferralOnProfileComplete } from "@/lib/referral/apply";
import { ensureUserReferralCode } from "@/lib/referral/ensure-code";
import { reconcileUserCoupons } from "@/lib/coupons/reconcile";

// 간편가입 완료: 로그인 회원의 이름·전화(필수)와 마케팅 동의(선택)를 저장하고
// profileCompleted 를 true 로 표시한다. /welcome 폼에서 호출한다.
const schema = z.object({
  name: z.string().trim().min(2, "이름을 2자 이상 입력해주세요.").max(20),
  phone: z.string().trim().min(1, "전화번호를 입력해주세요."),
  marketingConsent: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const phone = toDomesticKR(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)" },
      { status: 400 }
    );
  }

  const wasProfileCompleted = user.profileCompleted;
  const referralFromCookie = request.cookies.get(REFERRAL_COOKIE_NAME)?.value ?? null;

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        phone,
        marketingConsent: parsed.data.marketingConsent,
        profileCompleted: true,
      },
    });

    // 본인 추천 코드 확보 (추천인 페이지·공유용)
    await ensureUserReferralCode(user.id, prisma);

    // 기존 SIGNUP 쿠폰 등 동기화
    if (user.supabaseId) {
      await reconcileUserCoupons({
        id: user.id,
        supabaseId: user.supabaseId,
        profileCompleted: true,
      });
    }

    // 최초 가입 완료 시에만 추천 인정
    if (!wasProfileCompleted && referralFromCookie) {
      const result = await applyReferralOnProfileComplete(
        {
          inviteeUserId: user.id,
          rawCode: referralFromCookie,
          isFirstProfileComplete: true,
          inviteeKakaoId: user.kakaoId ?? null,
        },
        prisma,
      );
      if (!result.applied) {
        console.info("[complete-profile] referral not applied:", result.reason);
      }
    }
  } catch (err) {
    console.error("[POST /api/auth/complete-profile]", err);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }

  const response = NextResponse.json({ success: true });
  // 소비된 추천 쿠키 제거
  if (referralFromCookie) {
    response.cookies.set(REFERRAL_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
