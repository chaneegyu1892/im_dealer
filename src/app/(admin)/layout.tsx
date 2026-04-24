import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getAdminSession } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();

  return (
    <div className="h-screen flex bg-[#F4F5F8] overflow-hidden">
      {admin && <AdminSidebar />}
      <div className={admin ? "flex-1 ml-[220px] flex flex-col h-full overflow-hidden" : "flex-1 flex flex-col h-full overflow-hidden"}>
        <main className="flex-1 min-h-0 p-5 overflow-y-auto scrollbar-hide">
          {children}
        </main>
      </div>
    </div>
  );
}
