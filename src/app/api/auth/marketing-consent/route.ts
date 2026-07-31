import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/admin-auth";
import { getKakaoAccessToken } from "@/lib/kakao/token";
import { revokeKakaoServiceTerms } from "@/lib/kakao/account";

// 마케팅 수신 동의 변경(동의/철회). 마이페이지 토글에서 호출한다.
// - 앱 DB(User.marketingConsent)가 발송 여부의 SSOT.
// - 철회 시 카카오 약관 동의도 best-effort 로 함께 철회해 기록을 맞춘다.
const schema = z.object({ consent: z.boolean() });

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const consent = parsed.data.consent;

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { marketingConsent: consent },
    });
  } catch (err) {
    console.error("[PATCH /api/auth/marketing-consent]", err);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }

  // 철회 시 카카오 약관 동의도 철회(best-effort — 실패해도 DB 기준으로 발송 차단됨).
  if (!consent && user.provider === "kakao" && user.supabaseId) {
    const tag = process.env.KAKAO_MARKETING_TERMS_TAG?.trim() || "marketing";
    const accessToken = await getKakaoAccessToken(user.supabaseId);
    if (accessToken) {
      await revokeKakaoServiceTerms(accessToken, [tag]);
    }
  }

  return NextResponse.json({ success: true, marketingConsent: consent });
}
