import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { apiRateLimit, strictRateLimit } from "@/lib/rate-limit";

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

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  // ── API 라우트 Rate Limit 보호 ────────────────────────────────────
  if (pathname.startsWith("/api/") && !isAdminApi) {
    const isStrictApi = pathname.includes("/quote") || pathname.includes("/recommend");
    const ratelimit = isStrictApi ? strictRateLimit : apiRateLimit;

    if (ratelimit) {
      const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "127.0.0.1";
      const { success, limit, reset, remaining } = await ratelimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        );
      }
    }
  }

  // ── 어드민 라우트 보호 ────────────────────────────────────
  if (isAdminPage || isAdminApi) {
    const accessCookie = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
    const jwtToken = request.cookies.get(ADMIN_JWT_COOKIE)?.value;

    const hasValidAccessCookie = accessCookie ? isValidAccessToken(accessCookie) : false;
    const hasValidJwt = jwtToken ? await isValidAdminJwt(jwtToken) : false;

    if (isAdminApi) {
      if (pathname !== "/api/admin/auth/login" && pathname !== "/api/admin/auth/logout") {
        if (!hasValidJwt) {
          return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
      }
    } else {
      // 액세스 쿠키 또는 JWT 없이 /admin/login 이외 경로 접근 → 존재 숨김
      if (!hasValidAccessCookie && !hasValidJwt && pathname !== "/admin/login") {
        return new NextResponse(null, { status: 404 });
      }

      // 액세스 쿠키는 있지만 JWT(로그인 세션) 없음 → 로그인 페이지로
      if (pathname !== "/admin/login" && !hasValidJwt) {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
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
