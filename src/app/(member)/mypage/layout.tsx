import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/admin-auth";

export default async function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user?.role === "member" && !user.profileCompleted) {
    redirect(`/welcome?next=${encodeURIComponent("/mypage")}`);
  }
  return children;
}
