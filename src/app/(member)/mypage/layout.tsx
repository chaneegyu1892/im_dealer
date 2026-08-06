import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/admin-auth";
import { MyPageTabs } from "@/components/mypage/MyPageTabs";

export default async function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user?.role === "member" && !user.profileCompleted) {
    redirect(`/welcome?next=${encodeURIComponent("/mypage")}`);
  }
  return (
    <div className="page-container mx-auto max-w-[960px] pt-7 md:pt-10">
      <MyPageTabs />
      {children}
    </div>
  );
}
