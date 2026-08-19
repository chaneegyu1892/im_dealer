import * as Sentry from "@sentry/nextjs";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 라이브러리 기본값(httpOnly: false)은 유지하되, 세션 쿠키가 평문 HTTP로
      // 유출되지 않도록 운영에서는 secure 플래그를 강제한다.
      cookieOptions: {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
            Sentry.setTag("budget_tag", "refresh");
            Sentry.addBreadcrumb({
              category: "auth.refresh",
              message: "supabase session cookies written",
              level: "info",
              data: { outcome: "success" },
            });
          } catch {
            // Server component에서 set 불가 — middleware가 갱신함
            Sentry.setTag("budget_tag", "refresh");
            Sentry.addBreadcrumb({
              category: "auth.refresh",
              message: "supabase session cookie write skipped",
              level: "info",
              data: { outcome: "skipped" },
            });
          }
        },
      },
    }
  );
}
