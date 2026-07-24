import { requireAccess } from "@/lib/require-access";

// 카카오 로그인한 일반 회원(또는 어드민) 전용 라우트 그룹.
// 비로그인 사용자는 원래 목적지(/mypage)를 보존한 로그인 화면으로 이동한다.
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccess("/mypage");
  return <>{children}</>;
}
