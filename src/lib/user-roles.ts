// 통합 User 테이블의 역할 목록 (member 포함).
// access-control 의 ALL_ROLES 와 일관되게 유지한다. guest 는 비로그인 가상 역할이라 제외.
export const USER_ROLES = ["member", "dealer", "staff", "admin", "superadmin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  member: "일반 회원",
  dealer: "제휴 딜러",
  staff: "운영자",
  admin: "관리자",
  superadmin: "최고 관리자",
};

export type UsersListItem = {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
  isActive: boolean;
  provider: string | null;
  kakaoNickname: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};
