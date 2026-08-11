import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireAccess } from "@/lib/require-access";
import { Header } from "@/components/layout/Header";
import { ChannelTalk } from "@/components/layout/ChannelTalk";
import { MyMenuFAB } from "@/components/layout/MyMenuFAB";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

// 카카오 로그인한 일반 회원(또는 어드민) 전용 라우트 그룹.
// 비로그인 사용자는 원래 목적지를 보존한 로그인 화면으로 이동한다.
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 미들웨어가 세팅한 x-pathname 으로 실제 경로를 판정한다.
  // 하드코딩하면 /mypage/coupons 로 들어온 비로그인 사용자가 로그인 후 마이페이지 홈으로 간다.
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "/mypage";
  await requireAccess(pathname);
  return (
    <>
      <ChannelTalk />
      <Header />
      {children}
      <MyMenuFAB />
    </>
  );
}
