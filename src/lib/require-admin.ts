import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isAdminLike, isSuperAdmin } from "@/lib/admin-roles";
import { isAtLeast, toRole, type Role } from "@/lib/access-control";

export async function requireAdmin() {
  const admin = await getAdminSession();
  if (!admin) {
    return { admin: null, error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  return { admin, error: null };
}

// admin 또는 superadmin 보유 시 통과 (대부분의 어드민 보호 엔드포인트)
export async function requireAdminLike() {
  const admin = await getAdminSession();
  if (!admin) {
    return { admin: null, error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  if (!isAdminLike(admin.role)) {
    return { admin: null, error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { admin, error: null };
}

// superadmin 전용 (민감 작업용 — 향후 어드민 계정 관리/감사 로그 등에 활용)
export async function requireSuperAdmin() {
  const admin = await getAdminSession();
  if (!admin) {
    return { admin: null, error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  if (!isSuperAdmin(admin.role)) {
    return { admin: null, error: NextResponse.json({ error: "최종관리자 권한이 필요합니다." }, { status: 403 }) };
  }
  return { admin, error: null };
}

// 역할 위계 기반 가드 (access-control SSOT 기준).
// dealer가 차단돼야 하는 API 등 매트릭스와 일관되게 권한을 강제할 때 사용.
export async function requireRoleAtLeast(minimum: Role) {
  const admin = await getAdminSession();
  if (!admin) {
    return { admin: null, error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  const role = toRole(admin.role, true);
  if (!isAtLeast(role, minimum)) {
    return { admin: null, error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { admin, error: null };
}
