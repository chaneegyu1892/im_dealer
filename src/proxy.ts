import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const ADMIN_JWT_COOKIE = "admin_token";
const ADMIN_ACCESS_COOKIE = "admin_access";

function getAdminSecret() {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) return null;
  return new TextEncoder().encode(s);
}

async function isValidAdminJwt(token: string): Promise<boolean> {
  const secret = getAdminSecret();
  if (!secret) return false;
  try {
    await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

function isValidAccessToken(token: string): boolean {
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  if (!expected) return false;
  return token === expected;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── 어드민 라우트 보호 ────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const queryToken = searchParams.get("t");
    const accessCookie = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
    const jwtToken = request.cookies.get(ADMIN_JWT_COOKIE)?.value;

    const hasValidAccessCookie = accessCookie
      ? isValidAccessToken(accessCookie)
      : false;

    const hasValidQueryToken = queryToken
      ? isValidAccessToken(queryToken)
      : false;

    const hasValidJwt = jwtToken ? await isValidAdminJwt(jwtToken) : false;

    // 로그인 페이지거나, 유효한 JWT(세션)가 있거나, 액세스 토큰이 있는 경우에만 페이지 노출
    if (!hasValidAccessCookie && !hasValidQueryToken && !hasValidJwt && pathname !== "/admin/login") {
      // 존재 자체를 숨김
      return new NextResponse(null, { status: 404 });
    }

    // 쿼리 토큰으로 진입한 경우 → 쿠키 발급 후 clean URL로 리다이렉트
    if (hasValidQueryToken && !hasValidAccessCookie) {
      const cleanUrl = new URL(pathname, request.url);
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set({
        name: ADMIN_ACCESS_COOKIE,
        value: queryToken!,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30일
      });
      return response;
    }

    // 2단계: 로그인 인증 확인 (/admin/login 제외)
    if (pathname !== "/admin/login") {
      if (!hasValidJwt) {
        return NextResponse.redirect(new URL("/admin/login", request.url));
      }
    }
  }

  // ── Supabase 세션 갱신 ───────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
