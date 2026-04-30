import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { apiRateLimit, strictRateLimit } from "@/lib/rate-limit";

const ADMIN_JWT_COOKIE = "admin_token";
const ADMIN_ACCESS_COOKIE = "admin_access";

function getAdminSecret() {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_JWT_SECRET 환경변수가 설정되지 않았습니다.");
    }
    return null;
  }
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

// 타이밍 공격 방어를 위한 상수 시간 비교 (Edge runtime 호환)
function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isValidAccessToken(token: string): boolean {
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_ACCESS_TOKEN 환경변수가 설정되지 않았습니다.");
    }
    return false;
  }
  return timingSafeEqualString(token, expected);
}

// x-forwarded-for 첫 번째 IP만 사용 (스푸핑 시 체인 뒤를 노출시킬 수 있음).
// TRUST_PROXY 가 true 일 때만 헤더를 신뢰. 그 외에는 NextRequest.ip 또는 null.
function getClientIp(request: NextRequest): string | null {
  const trustProxy = process.env.TRUST_PROXY === "true";
  if (trustProxy) {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const xreal = request.headers.get("x-real-ip");
    if (xreal) return xreal.trim();
  }
  // Vercel/Edge 의 ip 속성
  const directIp = (request as unknown as { ip?: string }).ip;
  return directIp ?? null;
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
      const ip = getClientIp(request);
      // IP 식별 불가 시 운영에서는 차단(스푸핑 우회 방지), 로컬은 통과.
      if (!ip) {
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "요청 출처를 식별할 수 없습니다." },
            { status: 400 }
          );
        }
      }
      const rateKey = ip ?? "local-dev";
      const { success, limit, reset, remaining } = await ratelimit.limit(rateKey);

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Supabase 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
