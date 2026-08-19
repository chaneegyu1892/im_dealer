import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  REFERRAL_COOKIE_MAX_AGE_SEC,
  REFERRAL_COOKIE_NAME,
} from "@/lib/referral/attribution";
import { normalizeReferralCode } from "@/lib/referral/code";
import { REFERRAL_REDEEM_PATH } from "@/lib/referral/pending-code";

type RouteContext = {
  params: Promise<{ code: string }>;
};

/**
 * 추천 링크 진입점.
 * 유효 코드면 쿠키에 저장하고 홈(또는 login)으로 보낸다.
 */
export async function GET(request: Request, context: RouteContext) {
  const { code: raw } = await context.params;
  const code = normalizeReferralCode(raw);
  const origin = new URL(request.url).origin;
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim() || origin;
  let redirectBase = origin;
  try {
    redirectBase = new URL(appOrigin).origin;
  } catch {
    redirectBase = origin;
  }

  if (!code) {
    return NextResponse.redirect(`${redirectBase}/?ref=invalid`);
  }

  const inviter = await prisma.user.findFirst({
    where: { referralCode: code, isActive: true },
    select: { id: true },
  });

  if (!inviter) {
    return NextResponse.redirect(`${redirectBase}/?ref=invalid`);
  }

  const login = new URL("/login", redirectBase);
  login.searchParams.set("ref", code);
  login.searchParams.set("next", REFERRAL_REDEEM_PATH);
  const response = NextResponse.redirect(login);
  response.cookies.set(REFERRAL_COOKIE_NAME, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFERRAL_COOKIE_MAX_AGE_SEC,
  });
  return response;
}
