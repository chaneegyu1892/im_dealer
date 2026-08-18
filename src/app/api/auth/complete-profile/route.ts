import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";
import { toDomesticKR } from "@/lib/phone";
import { REFERRAL_COOKIE_NAME } from "@/lib/referral/attribution";
import { applyReferralOnProfileComplete } from "@/lib/referral/apply";
import { ensureUserReferralCode } from "@/lib/referral/ensure-code";
import { normalizeReferralCode } from "@/lib/referral/code";
import { reconcileUserCoupons } from "@/lib/coupons/reconcile";

// 간편가입 완료: 로그인 회원의 이름·전화(필수)와 마케팅 동의(선택)를 저장하고
// profileCompleted 를 true 로 표시한다. /welcome 폼에서 호출한다.
const schema = z.object({
  name: z.string().trim().min(2, "이름을 2자 이상 입력해주세요.").max(20),
  phone: z.string().trim().min(1, "전화번호를 입력해주세요."),
  marketingConsent: z.boolean().default(false),
  // 추천인 코드 직접 입력(선택). 추천 링크 쿠키가 없어도 코드만으로 인정받는 경로.
  referralCode: z.string().trim().max(10).optional(),
});

type TypedCodeCheck =
  | { ok: true; code: string | null }
  | { ok: false; message: string };

// 입력 코드는 profileCompleted 가 켜지기 전에 검증한다. 켜진 뒤에는 추천 인정이
// 불가능(NOT_NEW_PROFILE)한데 오타를 그때 알려주면 고칠 기회가 없기 때문이다.
// 존재/비활성은 같은 문구로 답해 코드 존재 여부를 구분해 노출하지 않는다.
async function checkTypedReferralCode(
  raw: string | undefined,
  inviteeUserId: string,
): Promise<TypedCodeCheck> {
  if (!raw) return { ok: true, code: null };

  const code = normalizeReferralCode(raw);
  if (!code) {
    return { ok: false, message: "추천인 코드 형식이 올바르지 않습니다. (예: K4821)" };
  }
  const inviter = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, isActive: true },
  });
  if (!inviter || !inviter.isActive) {
    return { ok: false, message: "추천인 코드를 확인해주세요. 사용할 수 없는 코드입니다." };
  }
  if (inviter.id === inviteeUserId) {
    return { ok: false, message: "본인의 추천 코드는 입력할 수 없습니다." };
  }
  return { ok: true, code };
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireActiveUser();
  if (authError) return authError;

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

  // 이미 가입 완료된 회원의 재호출에서는 코드가 어차피 인정될 수 없으므로 검증하지 않는다.
  let typedReferralCode: string | null = null;
  if (!wasProfileCompleted) {
    let check: TypedCodeCheck;
    try {
      check = await checkTypedReferralCode(parsed.data.referralCode, user.id);
    } catch (err) {
      console.error("[POST /api/auth/complete-profile] referral code check failed:", err);
      return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: 400 });
    }
    typedReferralCode = check.code;
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        phone,
        marketingConsent: parsed.data.marketingConsent,
        profileCompleted: true,
        // 추천 코드 사후 입력 창구(7일)의 기준 시각. 최초 완료 때만 기록한다.
        ...(!wasProfileCompleted ? { profileCompletedAt: new Date() } : {}),
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

    // 최초 가입 완료 시에만 추천 인정. 직접 입력한 코드가 쿠키보다 우선한다.
    const referralRawCode = typedReferralCode ?? referralFromCookie;
    if (!wasProfileCompleted && referralRawCode) {
      const result = await applyReferralOnProfileComplete(
        {
          inviteeUserId: user.id,
          rawCode: referralRawCode,
          isWithinEntryWindow: true,
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
