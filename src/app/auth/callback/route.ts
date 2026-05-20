import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const redirectOrigin = getRedirectOrigin(origin);

  if (!code) {
    return NextResponse.redirect(`${redirectOrigin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.user) {
    console.error("[auth/callback] exchangeCodeForSession error:", error);
    return NextResponse.redirect(`${redirectOrigin}/login?error=auth_failed`);
  }

  const user = data.user;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const provider = typeof appMeta.provider === "string" ? appMeta.provider : null;
  const kakaoNickname =
    provider === "kakao" && typeof meta.nickname === "string" ? meta.nickname : null;
  // 카카오 이메일 미동의 시 빈 문자열을 반환 → unique 충돌 방지를 위해 null 로 정규화.
  const normalizedEmail = user.email && user.email.trim() ? user.email : null;
  const displayName =
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.nickname === "string" && meta.nickname) ||
    normalizedEmail?.split("@")[0] ||
    "회원";

  try {
    await prisma.user.upsert({
      where: { supabaseId: user.id },
      update: {
        lastLoginAt: new Date(),
        // 이미 존재하는 사용자의 role/isActive 는 보존. email/nickname 은 최신값으로 동기화.
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(kakaoNickname ? { kakaoNickname } : {}),
      },
      create: {
        supabaseId: user.id,
        email: normalizedEmail,
        name: displayName,
        role: "member",
        provider,
        kakaoNickname,
        isActive: true,
        lastLoginAt: new Date(),
      },
    });
  } catch (err) {
    // upsert 실패해도 세션은 살아있다. 다음 요청에서 lazy 보정 가능.
    // 어드민 가드는 prisma.user 행 부재 시 null 반환이라 권한 우회 위험 없음.
    console.error("[auth/callback] user upsert failed:", err);
  }

  return NextResponse.redirect(`${redirectOrigin}${next}`);
}

function getRedirectOrigin(requestOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  return requestOrigin;
}
