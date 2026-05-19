// 통합 접근 가드.
// - 서버 컴포넌트(page.tsx, layout.tsx): require* 함수를 호출하면 권한 부족 시 redirect
// - API route handler: NextResponse를 반환하는 형태는 require-admin.ts에서 그대로 사용

import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { getAdminSession } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import {
  hasAccess,
  matchPathPolicy,
  toRole,
  type Role,
} from "@/lib/access-control";

interface AccessContext {
  role: Role;
  admin: User | null;
  userId: string | null;
}

async function resolveContext(): Promise<AccessContext> {
  const admin = await getAdminSession();
  if (admin) {
    return { role: toRole(admin.role, true), admin, userId: admin.supabaseId ?? null };
  }
  // 어드민이 아니면 Supabase 세션만 확인
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return { role: "member", admin: null, userId: user.id };
  } catch (error) {
    console.error("[require-access] Supabase 세션 확인 실패:", error);
  }
  return { role: "guest", admin: null, userId: null };
}

// 페이지 경로 기준 가드.
// - 비로그인 → /login?next=path
// - 어드민 권한이 아예 없는 사용자(member)가 어드민 영역 접근 → /
// - 어드민이지만 특정 페이지 권한 없음 → /admin (대시보드)
// - 그 외 → /unauthorized
export async function requireAccess(pathname: string): Promise<AccessContext> {
  const ctx = await resolveContext();
  if (hasAccess(ctx.role, pathname)) return ctx;

  if (ctx.role === "guest") {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  if (pathname.startsWith("/admin")) {
    // 어드민 영역에서 권한 부족
    if (ctx.admin) {
      // 어드민이지만 특정 하위 페이지 권한 없음 → 대시보드로 (대시보드는 모든 어드민 통과)
      redirect("/admin");
    }
    // 어드민이 아닌 일반 회원(member)이 어드민 영역 접근 → 홈으로
    redirect("/");
  }
  redirect("/unauthorized");
}

// 명시적 역할 화이트리스트 가드 (특정 페이지에 정책이 정의돼 있지 않을 때 사용)
export async function requireRole(allowed: ReadonlyArray<Role>): Promise<AccessContext> {
  const ctx = await resolveContext();
  if (allowed.includes(ctx.role)) return ctx;
  if (ctx.role === "guest") redirect("/login");
  redirect("/unauthorized");
}

// 카카오 로그인 회원만 통과 (member 이상)
export async function requireMember(): Promise<AccessContext> {
  const ctx = await resolveContext();
  if (ctx.role !== "guest") return ctx;
  redirect("/login");
}

// 라우트 그룹 layout 등에서 매처 없이 단순히 prefix 기준으로 검사하고 싶을 때 사용
export function isPolicyDefined(pathname: string): boolean {
  return matchPathPolicy(pathname) !== null;
}
