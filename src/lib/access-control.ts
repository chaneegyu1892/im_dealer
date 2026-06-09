// 모든 페이지/리소스 접근 권한의 단일 출처(SSOT).
// 사이드바, 페이지 가드, API 권한 체크가 모두 이 파일을 참조한다.

import { ADMIN_ROLES, type AdminRole } from "./admin-roles";

// 전체 역할: 어드민 4단계 + 일반 회원 + 비로그인
export const ALL_ROLES = [
  "guest",
  "member",
  ...ADMIN_ROLES,
] as const;

export type Role = "guest" | "member" | AdminRole;

// 역할 위계 (숫자가 클수록 강한 권한)
const ROLE_LEVEL: Record<Role, number> = {
  guest: 0,
  member: 1,
  dealer: 2,
  staff: 3,
  admin: 4,
  superadmin: 5,
};

// 페이지/경로별 허용 역할.
// - 키는 라우트 prefix (정확 매칭 우선, 없으면 가장 긴 prefix가 매칭)
// - 값은 해당 역할만 허용 (포함 관계가 아니라 명시 화이트리스트)
export const PAGE_ACCESS = {
  // 어드민
  "/admin": ["dealer", "staff", "admin", "superadmin"],
  "/admin/analytics": ["staff", "admin", "superadmin"],
  "/admin/quotations": ["staff", "admin", "superadmin"],
  "/admin/users": ["staff", "admin", "superadmin"],
  "/admin/vehicles": ["staff", "admin", "superadmin"],
  "/admin/inventory": ["staff", "admin", "superadmin"],
  "/admin/reviews": ["staff", "admin", "superadmin"],
  "/admin/memo": ["staff", "admin", "superadmin"],
  "/admin/notifications": ["staff", "admin", "superadmin"],
  "/admin/verifications": ["staff", "admin", "superadmin"],
  "/admin/finance": ["admin", "superadmin"],
  "/admin/ai": ["admin", "superadmin"],
  "/admin/audit-logs": ["admin", "superadmin"],
  "/admin/settings": ["admin", "superadmin"],
  "/admin/recovery-rates": ["admin", "superadmin"],
  // 회원 전용 (라우트 그룹용)
  "/mypage": ["member", "dealer", "staff", "admin", "superadmin"],
} as const satisfies Record<string, ReadonlyArray<Role>>;

export type AccessPath = keyof typeof PAGE_ACCESS;

// 가장 긴 prefix를 매칭. 정의된 정책이 없으면 null.
export function matchPathPolicy(pathname: string): ReadonlyArray<Role> | null {
  const keys = Object.keys(PAGE_ACCESS) as AccessPath[];
  // 긴 경로부터 검사하여 더 구체적인 정책 우선
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (pathname === key || pathname.startsWith(key + "/")) {
      return PAGE_ACCESS[key];
    }
  }
  return null;
}

// 특정 경로에 해당 역할이 접근 가능한지
export function hasAccess(role: Role, pathname: string): boolean {
  const allowed = matchPathPolicy(pathname);
  if (!allowed) return true; // 정책 미정의 경로는 기본 허용
  return allowed.includes(role);
}

// 사이드바 등에서 사용: 역할이 접근 가능한 정의된 경로 목록
export function getAccessiblePaths(role: Role): AccessPath[] {
  return (Object.entries(PAGE_ACCESS) as [AccessPath, ReadonlyArray<Role>][])
    .filter(([, roles]) => roles.includes(role))
    .map(([path]) => path);
}

// 역할 비교 헬퍼
export function isAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minimum];
}

// AdminUser.role(string) → Role 안전 변환
export function toRole(roleStr: string | null | undefined, isLoggedIn: boolean): Role {
  if (roleStr && (ADMIN_ROLES as readonly string[]).includes(roleStr)) {
    return roleStr as AdminRole;
  }
  return isLoggedIn ? "member" : "guest";
}
