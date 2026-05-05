import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { getAdminSession } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();

  // 미들웨어는 JWT 서명만 보지만 레이아웃은 DB 조회/isActive까지 검증한다.
  // 어드민 레코드가 삭제되거나 비활성화된 경우 사이드바만 사라진 어색한 화면 대신
  // 미들웨어와 동일하게 로그인으로 보낸다. (/admin/login 자체는 예외)
  if (!admin) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.endsWith("/admin/login")) {
      const from = pathname || "/admin";
      redirect(`/admin/login?from=${encodeURIComponent(from)}`);
    }
  }

  const adminData = admin ? {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role
  } : null;

  return (
    <div className="h-screen flex bg-[#F4F5F8] overflow-hidden">
      {adminData && <AdminSidebar admin={adminData} />}
      <div className={adminData ? "flex-1 ml-[220px] flex flex-col h-full overflow-hidden" : "flex-1 flex flex-col h-full overflow-hidden"}>
        <main className="flex-1 min-h-0 p-5 overflow-y-auto scrollbar-hide">
          {children}
        </main>
      </div>
    </div>
  );
}
