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
  const providerToken =
    typeof data.session?.provider_token === "string" ? data.session.provider_token : null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const provider = typeof appMeta.provider === "string" ? appMeta.provider : null;
  const kakaoNickname =
    provider === "kakao" && typeof meta.nickname === "string" ? meta.nickname : null;
  // 카카오 이메일 미동의 시 빈 문자열을 반환 → unique 충돌 방지를 위해 null 로 정규화.
  const normalizedEmail = user.email && user.email.trim() ? user.email : null;
  // 카카오 전화번호: 동의 항목(전화번호) 승인 시 Supabase user.phone 또는 user_metadata 에 담긴다.
  // 카카오는 "+82 10-1234-5678" 형태로 내려줌 — 저장은 원본, 채널톡 전달 시 toE164KR 로 +82 정규화.
  const rawPhone =
    (typeof user.phone === "string" && user.phone.trim() && user.phone) ||
    (typeof meta.phone_number === "string" && meta.phone_number.trim() && meta.phone_number) ||
    (typeof meta.phone === "string" && meta.phone.trim() && meta.phone) ||
    null;
  const normalizedPhone = rawPhone ? rawPhone.trim() : null;
  const displayName =
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.nickname === "string" && meta.nickname) ||
    normalizedEmail?.split("@")[0] ||
    "회원";

  // Supabase 가 카카오 전화번호를 세션/메타에 실어주지 않는 경우 대비:
  // provider_token 으로 카카오 사용자 API 를 직접 조회해 전화번호를 보강한다.
  // (전화번호 동의 미요청/미승인 시엔 값이 없어 no-op — 로그인엔 영향 없음)
  let resolvedPhone = normalizedPhone;
  if (
    !resolvedPhone &&
    provider === "kakao" &&
    providerToken &&
    process.env.NEXT_PUBLIC_KAKAO_REQUEST_PHONE === "true"
  ) {
    resolvedPhone = await fetchKakaoPhone(providerToken);
  }

  try {
    await prisma.user.upsert({
      where: { supabaseId: user.id },
      update: {
        lastLoginAt: new Date(),
        // 이미 존재하는 사용자의 role/isActive 는 보존. email/nickname/phone 은 최신값으로 동기화.
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        ...(kakaoNickname ? { kakaoNickname } : {}),
        ...(resolvedPhone ? { phone: resolvedPhone } : {}),
      },
      create: {
        supabaseId: user.id,
        email: normalizedEmail,
        name: displayName,
        role: "member",
        provider,
        kakaoNickname,
        phone: resolvedPhone,
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

// 카카오 사용자 API 에서 전화번호를 조회한다. 동의(전화번호)한 경우에만 값이 온다.
// 카카오는 "+82 10-1234-5678" 형태로 내려주며, 저장은 원본(채널톡 전달 시 toE164KR 로 정규화).
async function fetchKakaoPhone(providerToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      kakao_account?: { phone_number?: unknown };
    };
    const phone = json.kakao_account?.phone_number;
    return typeof phone === "string" && phone.trim() ? phone.trim() : null;
  } catch (err) {
    console.error("[auth/callback] fetchKakaoPhone failed:", err);
    return null;
  }
}

function getRedirectOrigin(requestOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  return requestOrigin;
}
