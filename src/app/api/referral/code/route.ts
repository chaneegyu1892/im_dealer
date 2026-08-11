import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { requireActiveUser } from "@/lib/require-user";
import { buildReferralLink } from "@/lib/referral/code";
import { ensureReferralCode } from "@/lib/referral/ensure-code";

/** 코드 발급 트리거. 이미 있으면 기존 코드를 그대로 돌려준다(멱등). */
export async function POST() {
  const { user, error } = await requireActiveUser();
  if (error) return error;

  try {
    const code = await ensureReferralCode(user);
    return NextResponse.json({ code, link: buildReferralLink(code) });
  } catch (err) {
    console.error("[POST /api/referral/code]", err);
    Sentry.captureException(err, { tags: { route: "referral/code" } });
    return NextResponse.json(
      { error: "추천인 코드를 준비하지 못했습니다." },
      { status: 500 }
    );
  }
}
