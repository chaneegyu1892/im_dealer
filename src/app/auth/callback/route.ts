import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const redirectOrigin = getRedirectOrigin(origin);

  if (!code) {
    return NextResponse.redirect(`${redirectOrigin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error);
    return NextResponse.redirect(`${redirectOrigin}/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${redirectOrigin}${next}`);
}

function getRedirectOrigin(requestOrigin: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  return requestOrigin;
}
