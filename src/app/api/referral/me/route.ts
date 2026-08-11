import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireActiveUser } from "@/lib/require-user";
import { buildReferralLink } from "@/lib/referral/code";
import { ensureReferralCode } from "@/lib/referral/ensure-code";

/** 내 추천인 코드·링크. 없으면 이 시점에 생성한다(멱등). */
export async function GET() {
  const { user, error } = await requireActiveUser();
  if (error) return error;

  try {
    const code = await ensureReferralCode(user);
    return NextResponse.json({ code, link: buildReferralLink(code) });
  } catch (err) {
    console.error("[GET /api/referral/me]", err);
    Sentry.captureException(err, { tags: { route: "referral/me" } });
    return NextResponse.json(
      { error: "추천인 코드를 준비하지 못했습니다." },
      { status: 500 }
    );
  }
}
