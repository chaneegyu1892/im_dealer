import { headers } from "next/headers";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAccess } from "@/lib/require-access";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 미들웨어가 세팅한 x-pathname을 기준으로 경로별 권한 판정
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "/admin";

  // requireAccess가 비로그인/권한부족을 자동 redirect 처리.
  // /admin 경로 정책이 dealer 이상이므로 통과 시 admin은 반드시 존재한다.
  const { admin } = await requireAccess(pathname);
  if (!admin) {
    // 정책상 도달 불가. 타입 안전 보강용.
    throw new Error("admin session missing after requireAccess");
  }

  const adminData = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };

  return (
    <div className="h-screen flex bg-[#F4F5F8] overflow-hidden">
      <AdminSidebar admin={adminData} />
      <div className="flex-1 ml-[220px] flex flex-col h-full overflow-hidden">
        <main className="flex-1 min-h-0 p-5 overflow-y-auto scrollbar-hide">
          {children}
        </main>
      </div>
    </div>
  );
}
