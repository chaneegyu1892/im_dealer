import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getAdminSession } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();

  // 미들웨어가 1차 차단하지만 layout은 DB 조회/isActive까지 검증한다.
  // 어드민 레코드가 삭제·비활성화된 경우 사이드바만 사라진 어색한 화면 대신
  // 권한 유무에 따라 홈/로그인으로 보낸다.
  if (!admin) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      redirect("/");
    } else {
      redirect("/login?next=/admin");
    }
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
