import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { prisma } from "@/lib/prisma";
import { fetchKakaoAccount, fetchAgreedTermTags } from "@/lib/kakao/account";
import { getChannelRelation } from "@/lib/kakao/channel";
import { isKakaoSyncEnabled } from "@/lib/kakao/scopes";
import { storeKakaoRefreshToken } from "@/lib/kakao/token";

const metadataSchema = z.record(z.unknown());

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeInternalPath(searchParams.get("next"));
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
  // 견적서 전송은 로그인 한참 뒤에 일어나는데 Supabase 는 provider_token 을 보관하지 않는다.
  // 리프레시 토큰을 암호화 저장해뒀다가 그때 액세스 토큰을 재발급한다.
  const providerRefreshToken =
    typeof data.session?.provider_refresh_token === "string"
      ? data.session.provider_refresh_token
      : null;
  const metaResult = metadataSchema.safeParse(user.user_metadata);
  const appMetaResult = metadataSchema.safeParse(user.app_metadata);
  const meta = metaResult.success ? metaResult.data : {};
  const appMeta = appMetaResult.success ? appMetaResult.data : {};
  const provider = typeof appMeta.provider === "string" ? appMeta.provider : null;
  // Supabase 카카오 provider 는 user_metadata 에 nickname 키를 만들지 않는다.
  // 닉네임은 name / preferred_username / user_name 에 담겨 온다(실측 확인).
  const metaNickname =
    provider === "kakao"
      ? pickString(meta, ["preferred_username", "user_name", "name", "nickname"])
      : null;
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

  // 카카오싱크: provider_token 으로 사용자 정보·약관동의·채널추가 상태를 보강한다.
  // Supabase 세션 메타에는 실명/채널관계가 실리지 않으므로 카카오 API 를 직접 조회한다.
  // 미동의·미승인 항목은 값이 없어 no-op — 로그인 흐름엔 영향 없다.
  const useSync = provider === "kakao" && providerToken !== null && isKakaoSyncEnabled();
  const kakaoAccessToken = useSync ? providerToken : null;

  const channelId = process.env.KAKAO_CHANNEL_ID?.trim();
  const accountPromise = kakaoAccessToken
    ? fetchKakaoAccount(kakaoAccessToken)
    : Promise.resolve(null);
  const channelRelationPromise =
    kakaoAccessToken && channelId
      ? getChannelRelation(kakaoAccessToken, channelId)
      : Promise.resolve(null);
  const agreedTagsPromise = kakaoAccessToken
    ? fetchAgreedTermTags(kakaoAccessToken)
    : Promise.resolve([]);
  const [account, channelRelation, agreedTags] = await Promise.all([
    accountPromise,
    channelRelationPromise,
    agreedTagsPromise,
  ]);

  const marketingTag = process.env.KAKAO_MARKETING_TERMS_TAG?.trim() || "marketing";
  const marketingConsent = agreedTags.includes(marketingTag);

  const resolvedPhone = normalizedPhone ?? account?.phone ?? null;
  // 동의항목 "이름"으로 받은 실명이 있으면 닉네임 기반 표시명보다 우선한다.
  const resolvedName = account?.name ?? displayName;
  const resolvedEmail = normalizedEmail ?? account?.email ?? null;
  // 카카오 API 의 프로필 닉네임을 우선하고, 없으면 Supabase 메타에서 받은 값을 쓴다.
  const kakaoNickname = account?.nickname ?? metaNickname;

  try {
    await prisma.user.upsert({
      where: { supabaseId: user.id },
      update: {
        lastLoginAt: new Date(),
        // 이미 존재하는 사용자의 role/isActive 는 보존. 동의로 받은 값만 최신화한다.
        ...(resolvedEmail ? { email: resolvedEmail } : {}),
        ...(kakaoNickname ? { kakaoNickname } : {}),
        ...(resolvedPhone ? { phone: resolvedPhone } : {}),
        ...(account?.name ? { name: account.name } : {}),
        ...(account?.kakaoId ? { kakaoId: account.kakaoId } : {}),
        ...(channelRelation ? { channelRelation } : {}),
        // 동의는 단조 증가 — 이번 로그인에서 동의했을 때만 켜고, 끄지 않는다(철회는 별도 경로).
        ...(marketingConsent ? { marketingConsent: true } : {}),
        ...(useSync ? { consentedAt: new Date() } : {}),
      },
      create: {
        supabaseId: user.id,
        email: resolvedEmail,
        name: resolvedName,
        role: "member",
        provider,
        kakaoId: account?.kakaoId ?? null,
        kakaoNickname,
        phone: resolvedPhone,
        channelRelation,
        marketingConsent,
        consentedAt: useSync ? new Date() : null,
        isActive: true,
        lastLoginAt: new Date(),
      },
    });
    // upsert 로 행이 보장된 뒤에 저장한다(암호화 키 미설정 시 내부에서 no-op).
    if (useSync) {
      await storeKakaoRefreshToken(user.id, providerRefreshToken);
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    // upsert 실패해도 세션은 살아있다. 다음 요청에서 lazy 보정 가능.
    // 어드민 가드는 prisma.user 행 부재 시 null 반환이라 권한 우회 위험 없음.
    console.error("[auth/callback] user upsert failed:", error);
  }

  return NextResponse.redirect(`${redirectOrigin}${next}`);
}

/** 메타데이터에서 첫 번째로 값이 있는 키를 고른다. */
function pickString(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getRedirectOrigin(requestOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    try {
      const url = new URL(configuredOrigin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }
  }

  return new URL(requestOrigin).origin;
}
