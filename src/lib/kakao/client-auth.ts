"use client";

import { createClient } from "@/lib/supabase/client";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { getKakaoScopes, isKakaoSyncEnabled } from "@/lib/kakao/scopes";
import {
  persistPendingReferralCode,
  readPendingReferralCode,
} from "@/lib/referral/pending-code";

type KakaoLoginRequest = {
  readonly next: string;
  readonly ref?: string | null;
};

export class KakaoOAuthStartError extends Error {
  readonly name = "KakaoOAuthStartError";
}

export async function startKakaoLogin({
  next,
  ref,
}: KakaoLoginRequest): Promise<void> {
  const safeNext = getSafeInternalPath(next);
  const referralCode =
    persistPendingReferralCode(ref) ?? readPendingReferralCode();
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const redirectOrigin = configuredOrigin
    ? configuredOrigin.replace(/\/+$/, "")
    : window.location.origin;
  const callback = new URL(`${redirectOrigin}/auth/callback`);
  callback.searchParams.set("next", safeNext);
  if (referralCode) callback.searchParams.set("ref", referralCode);
  const redirectTo = callback.toString();
  const scope = getKakaoScopes();
  // 카카오싱크 동의창에 "카카오톡 채널 추가"를 함께 노출시킨다 — 최초 로그인 한 번으로
  // 가입 + 채널추가가 끝난다. 콘솔 간편가입 설정만으로도 노출되지만, 채널을 명시하면
  // 콘솔 설정에 의존하지 않는다. queryParams 는 Supabase 가 카카오 authorize 로
  // 그대로 전달한다(위 scope 와 같은 경로).
  // 싱크 OFF 면 무의미하므로 붙이지 않는다.
  const channelPublicId = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID?.trim();
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo,
      scopes: scope,
      queryParams: {
        scope,
        ...(isKakaoSyncEnabled() && channelPublicId
          ? { channel_public_id: channelPublicId }
          : {}),
      },
    },
  });

  if (error) {
    throw new KakaoOAuthStartError(error.message);
  }
}
