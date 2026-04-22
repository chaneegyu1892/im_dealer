import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[#F4F5F8]">
      <AdminSidebar />
      <main className="flex-1 ml-[220px] min-h-screen overflow-x-hidden p-5">
        {children}
      </main>
    </div>
  );
}
