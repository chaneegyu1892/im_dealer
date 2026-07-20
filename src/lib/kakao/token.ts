// 카카오 액세스 토큰 재발급 — 저장해둔 리프레시 토큰으로 발송용 토큰을 얻는다.
//
// Supabase 세션은 provider_token 을 로그인 직후에만 실어주므로, 나중에(견적서 전송 시점)
// 카카오 API 를 호출하려면 리프레시 토큰을 우리가 보관했다가 직접 갱신해야 한다.
// 리프레시 토큰은 기존 PII 유틸(AES-256-GCM, PII_ENCRYPTION_KEY)로 암호화해
// User.kakaoRefreshToken 에 저장한다. connectedId 와 같은 String? 컬럼 패턴이다.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptString, encryptString } from "@/lib/pii";

const TOKEN_ENDPOINT = "https://kauth.kakao.com/oauth/token";

const kakaoTokenResponseSchema = z.object({
  access_token: z.string().trim().min(1),
  refresh_token: z.string().trim().min(1).optional(),
});

/**
 * 로그인 콜백에서 받은 리프레시 토큰을 암호화해 저장한다.
 * 토큰이 없거나 암호화 키 미설정이면 no-op — 로그인 흐름을 막지 않는다.
 */
export async function storeKakaoRefreshToken(
  supabaseId: string,
  refreshToken: string | null
): Promise<void> {
  if (!refreshToken) return;
  try {
    await prisma.user.update({
      where: { supabaseId },
      data: { kakaoRefreshToken: encryptString(refreshToken) },
    });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    // 키 미설정 시 encryptString 이 throw 한다 — 여기서 삼켜 로그인을 지킨다.
    console.error("[kakao] storeKakaoRefreshToken failed:", error);
  }
}

/**
 * 저장된 리프레시 토큰으로 액세스 토큰을 재발급한다.
 * 카카오가 리프레시 토큰을 회전시켜 내려주면(만료 임박 시) 새 값으로 갱신 저장한다.
 * 실패(토큰 없음·만료·연결 끊김) 시 null — 호출측이 재로그인을 안내한다.
 */
export async function getKakaoAccessToken(supabaseId: string): Promise<string | null> {
  const clientId = process.env.KAKAO_REST_API_KEY?.trim();
  if (!clientId) return null;

  const user = await prisma.user.findUnique({
    where: { supabaseId },
    select: { kakaoRefreshToken: true },
  });

  let refreshToken: string | null = null;
  try {
    // 키 불일치·변조 시 decryptString 이 throw — 토큰 없음으로 처리해 재로그인을 유도한다.
    refreshToken = user?.kakaoRefreshToken ? decryptString(user.kakaoRefreshToken) : null;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    console.error("[kakao] refresh token decrypt failed:", error);
    return null;
  }
  if (!refreshToken) return null;

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
        // 클라이언트 시크릿은 콘솔에서 활성화한 경우에만 필요하다.
        ...(process.env.KAKAO_CLIENT_SECRET?.trim()
          ? { client_secret: process.env.KAKAO_CLIENT_SECRET.trim() }
          : {}),
      }),
    });

    if (!res.ok) {
      // 리프레시 토큰이 만료·폐기된 경우(연결끊기 포함) 여기로 온다.
      console.error("[kakao] token refresh rejected:", res.status);
      return null;
    }

    const payload: unknown = await res.json();
    const result = kakaoTokenResponseSchema.safeParse(payload);
    if (!result.success) return null;

    if (result.data.refresh_token) {
      await storeKakaoRefreshToken(supabaseId, result.data.refresh_token);
    }

    return result.data.access_token;
  } catch (error) {
    if (error instanceof Error) {
      console.error("[kakao] getKakaoAccessToken failed:", error);
      return null;
    }
    throw error;
  }
}
