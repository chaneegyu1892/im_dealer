// 어드민 역할 정의 (권한 높음 → 낮음)
export const ADMIN_ROLES = ["superadmin", "admin", "staff", "dealer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

// 역할별 한글 라벨
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  superadmin: "최고 관리자",
  admin: "관리자",
  staff: "운영자",
  dealer: "딜러",
};

// admin 또는 superadmin 권한 보유 여부 (대부분의 어드민 보호 엔드포인트가 사용)
export function isAdminLike(role: string | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

// 복호화된 인증 상세 및 원본 서류를 열람할 수 있는 최소 권한.
// 전용 역할을 추가하기 전까지 admin/superadmin 에만 명시적으로 부여한다.
export function canReviewVerifications(role: string | null | undefined): boolean {
  return isAdminLike(role);
}

// superadmin 전용 권한 (다른 어드민 계정 관리, 감사 로그 등 민감 작업에 사용 가능)
export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "superadmin";
}

// 일반 회원(member)인지 — 어드민 가드에서 차단 대상 식별용
export function isMemberOnly(role: string | null | undefined): boolean {
  return role === "member" || !role;
}
