import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await prisma.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          provider: user.app_metadata?.provider ?? "kakao",
          name: user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
        },
        update: {
          name: user.user_metadata?.name ?? user.user_metadata?.full_name ?? null,
          avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
        },
      });
    } catch (err) {
      console.error("[auth/callback] prisma upsert error:", err);
      // 로그인 자체는 성공 — upsert 실패해도 진행
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
