import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/admin-auth";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { REFERRAL_COOKIE_NAME } from "@/lib/referral/attribution";
import { normalizeReferralCode } from "@/lib/referral/code";
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
  const safeNext = getSafeInternalPath(next);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/welcome?next=${safeNext}`)}`);
  }
  // 이미 가입 정보를 채운 회원은 곧바로 목적지로.
  if (user.profileCompleted) {
    redirect(safeNext);
  }

  // 추천 링크 쿠키는 httpOnly 라 클라이언트가 못 읽는다. 서버에서 읽어 프리필로 넘긴다.
  const cookieStore = await cookies();
  const referralFromCookie =
    normalizeReferralCode(cookieStore.get(REFERRAL_COOKIE_NAME)?.value) ?? "";

  return (
    <WelcomeForm
      defaultName={user.kakaoNickname ?? user.name ?? ""}
      defaultPhone={user.phone ?? ""}
      next={safeNext}
      defaultReferralCode={referralFromCookie}
    />
  );
}
