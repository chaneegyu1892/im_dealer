import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { apiRateLimit, strictRateLimit } from "@/lib/rate-limit";

const ADMIN_JWT_COOKIE = "admin_token";

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

// x-forwarded-for 첫 번째 IP만 사용 (스푸핑 시 체인 뒤를 노출시킬 수 있음).
// Vercel 등 신뢰 가능한 프록시 뒤에선 헤더만 신뢰. NextRequest.ip 는 Next 15+ 에서 제거됨.
function getClientIp(request: NextRequest): string | null {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.VERCEL === "1";
  if (trustProxy) {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const xreal = request.headers.get("x-real-ip");
    if (xreal) return xreal.trim();
  }
  return null;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  // ── API 라우트 Rate Limit 보호 ────────────────────────────────────
  // 일반 어드민 API는 인증으로 보호되지만, 업로드는 디스크/대역폭 부하가 크므로
  // 인증과 별개로 strict 레이트리밋을 적용한다.
  const isUploadApi = pathname === "/api/admin/upload";
  if (pathname.startsWith("/api/") && (!isAdminApi || isUploadApi)) {
    const isStrictApi =
      isUploadApi ||
      pathname.includes("/quote") ||
      pathname.includes("/recommend");
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
    const jwtToken = request.cookies.get(ADMIN_JWT_COOKIE)?.value;
    const hasValidJwt = jwtToken ? await isValidAdminJwt(jwtToken) : false;

    if (isAdminApi) {
      if (pathname !== "/api/admin/auth/login" && pathname !== "/api/admin/auth/logout") {
        if (!hasValidJwt) {
          return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
      }
    } else {
      // 로그인 세션 없으면 /admin/login 으로 리디렉트
      if (pathname !== "/admin/login" && !hasValidJwt) {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // ── 요청 헤더에 현재 경로 주입 (서버 컴포넌트에서 pathname 인지용) ────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // ── Supabase 세션 갱신 ───────────────────────────────────
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

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
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
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
