import { requireMember } from "@/lib/require-access";

// 카카오 로그인한 일반 회원(또는 어드민) 전용 라우트 그룹.
// 비로그인 사용자는 /login으로 즉시 리다이렉트된다.
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireMember();
  return <>{children}</>;
}
