import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { apiRateLimit, strictRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES } from "@/lib/admin-roles";

// Next 16 의 proxy.ts 는 항상 Node.js 런타임으로 실행됨 → runtime export 불필요.
// Prisma 직접 호출 가능. https://nextjs.org/docs/messages/middleware-to-proxy

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

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  // ── API 라우트 Rate Limit 보호 ────────────────────────────────────
  // strict: 실제로 리소스 무거운 / 어뷰징 위험 큰 경로만 (AI 추천, 이미지 생성, 파일 업로드)
  // 단순 견적 조회/계산/저장은 일반 apiRateLimit 으로 강등 — 비교/옵션 변경 시 정상 사용자가 걸리지 않게
  const isUploadApi = pathname === "/api/admin/upload";
  if (pathname.startsWith("/api/") && (!isAdminApi || isUploadApi)) {
    const isStrictApi =
      isUploadApi ||
      pathname.startsWith("/api/recommend") ||
      pathname === "/api/quote/image";
    const ratelimit = isStrictApi ? strictRateLimit : apiRateLimit;

    if (ratelimit) {
      const ip = getClientIp(request);
      if (!ip) {
        if (process.env.NODE_ENV === "production" && !isLocalHostname(request.nextUrl.hostname)) {
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

  const { data: { user } } = await supabase.auth.getUser();

  // ── 어드민 라우트 보호 (DB 기준 단일 출처) ─────────────────────────
  // Supabase 메타데이터가 아닌 prisma.user.role 을 진실로 삼는다. 권한 변경 즉시 반영.
  if (isAdminPage || isAdminApi) {
    let isAdmin = false;
    if (user) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { supabaseId: user.id },
          select: { role: true, isActive: true },
        });
        isAdmin =
          !!dbUser?.isActive &&
          (ADMIN_ROLES as readonly string[]).includes(dbUser?.role ?? "");
      } catch (err) {
        console.error("[proxy] DB role check failed:", err);
        // 안전한 기본값: 차단. DB 장애로 권한 우회되는 것보다 거부가 낫다.
        isAdmin = false;
      }
    }

    if (isAdminApi) {
      if (!isAdmin) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
      }
    } else {
      if (!isAdmin) {
        if (user) {
          // 로그인은 됐지만 관리자 권한 없음 → 홈으로
          return NextResponse.redirect(new URL("/", request.url));
        } else {
          // 비로그인 → 메인 로그인 페이지로
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("next", "/admin");
          return NextResponse.redirect(loginUrl);
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
