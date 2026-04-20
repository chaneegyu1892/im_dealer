import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getAdminSession } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();

  return (
    <div className="min-h-screen flex bg-[#F4F5F8]">
      {admin && <AdminSidebar />}
      {/* 사이드바 너비만큼 밀림 (어드민 세션이 있을 때만 마진 적용) */}
      <main className={admin ? "flex-1 ml-[220px] min-h-screen overflow-x-hidden" : "flex-1 min-h-screen"}>
        {children}
      </main>
    </div>
  );
}
