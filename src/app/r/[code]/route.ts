import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_CODE_REGEX } from "@/lib/referral/code";

const REFERRAL_COOKIE_NAME = "imdealer_ref";
const REFERRAL_COOKIE_MAX_AGE = 30 * 86400;

type RouteContext = {
  readonly params: Promise<{
    readonly code: string;
  }>;
};

// 서버 컴포넌트 렌더 중에는 cookies().set() 이 허용되지 않으므로(Server Action/Route
// Handler 전용) 이 캡처 라우트는 route handler 로 구현한다.
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { code } = await params;
  const homeUrl = new URL("/", request.url);
  const response = NextResponse.redirect(homeUrl);

  if (REFERRAL_CODE_REGEX.test(code)) {
    response.cookies.set(REFERRAL_COOKIE_NAME, code, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: REFERRAL_COOKIE_MAX_AGE,
    });
  }

  return response;
}
