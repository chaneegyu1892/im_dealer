// 어드민 역할 정의 (권한 높음 → 낮음)
export const ADMIN_ROLES = ["superadmin", "admin", "staff", "dealer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

// 역할별 한글 라벨
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  superadmin: "최종관리자",
  admin: "관리자",
  staff: "운영자",
  dealer: "딜러",
};

// admin 또는 superadmin 권한 보유 여부 (대부분의 어드민 보호 엔드포인트가 사용)
export function isAdminLike(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

// superadmin 전용 권한 (다른 어드민 계정 관리, 감사 로그 등 민감 작업에 사용 가능)
export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "superadmin";
}
