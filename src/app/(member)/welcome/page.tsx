import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/admin-auth";
import { WelcomeForm } from "./WelcomeForm";

export const dynamic = "force-dynamic";

// 간편가입 완료 화면. 카카오 로그인 직후 이름·전화가 없는 회원을 여기로 유도한다.
// (member) 그룹 layout 이 비로그인 사용자를 /login 으로 막아준다.
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // 오픈 리다이렉트 방지: 내부 경로(/…)만 허용.
  const safeNext = next && next.startsWith("/") ? next : "/";

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/welcome?next=${safeNext}`)}`);
  }
  // 이미 가입 정보를 채운 회원은 곧바로 목적지로.
  if (user.profileCompleted) {
    redirect(safeNext);
  }

  return (
    <WelcomeForm
      defaultName={user.kakaoNickname ?? user.name ?? ""}
      defaultPhone={user.phone ?? ""}
      next={safeNext}
    />
  );
}
