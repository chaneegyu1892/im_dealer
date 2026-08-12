import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  recordSupabaseDeletionOutcome,
  withdrawLocalMember,
} from "@/lib/account-withdrawal";
import { unlinkKakaoAccount } from "@/lib/kakao/account";
import { getKakaoAccessToken } from "@/lib/kakao/token";
import { requireActiveUser } from "@/lib/require-user";
import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({ confirmation: z.literal("회원탈퇴") }).strict();

function requestHasTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  try {
    const expected = configured ? new URL(configured).origin : new URL(request.url).origin;
    return origin === expected;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }

  const { user, error: authError } = await requireActiveUser();
  if (authError) return authError;
  if (user.role !== "member" || user.provider !== "kakao" || !user.supabaseId) {
    return NextResponse.json(
      { error: "카카오 회원 계정만 이 화면에서 탈퇴할 수 있습니다." },
      { status: 400 }
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "탈퇴 확인 문구가 일치하지 않습니다." }, { status: 400 });
  }

  let kakaoUnlinked = false;
  try {
    const accessToken = await getKakaoAccessToken(user.supabaseId);
    kakaoUnlinked = accessToken ? await unlinkKakaoAccount(accessToken) : false;
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "account-withdrawal-kakao" } });
  }

  let localResult;
  try {
    localResult = await withdrawLocalMember(user, kakaoUnlinked);
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "account-withdrawal-local" } });
    return NextResponse.json({ error: "회원 정보 파기에 실패했습니다." }, { status: 500 });
  }

  let sessionsRevoked = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "global" });
    sessionsRevoked = !error;
    if (error) throw error;
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "account-withdrawal-signout" } });
  }

  let supabaseAuthDeleted = false;
  try {
    const { error } = await supabaseAdmin().auth.admin.deleteUser(user.supabaseId);
    supabaseAuthDeleted = !error;
    if (error) throw error;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: "account-withdrawal-supabase-delete" },
    });
  }

  try {
    await recordSupabaseDeletionOutcome(
      localResult,
      kakaoUnlinked,
      supabaseAuthDeleted,
      user.supabaseId
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { operation: "account-withdrawal-audit" } });
  }

  return NextResponse.json({
    success: true,
    cleanup: {
      kakaoUnlinked,
      sessionsRevoked,
      supabaseAuthDeleted,
    },
  });
}
