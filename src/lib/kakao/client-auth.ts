"use client";

import { createClient } from "@/lib/supabase/client";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { getKakaoScopes } from "@/lib/kakao/scopes";

type KakaoLoginRequest = {
  readonly next: string;
};

export class KakaoOAuthStartError extends Error {
  readonly name = "KakaoOAuthStartError";
}

export async function startKakaoLogin({ next }: KakaoLoginRequest): Promise<void> {
  const safeNext = getSafeInternalPath(next);
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const redirectOrigin = configuredOrigin
    ? configuredOrigin.replace(/\/+$/, "")
    : window.location.origin;
  const redirectTo = `${redirectOrigin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  const scope = getKakaoScopes();
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo,
      scopes: scope,
      queryParams: {
        scope,
      },
    },
  });

  if (error) {
    throw new KakaoOAuthStartError(error.message);
  }
}
