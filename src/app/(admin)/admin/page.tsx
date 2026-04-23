import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/admin/dashboard/DashboardClient";
import { getAdminSession } from "@/lib/admin-auth";
import { getDashboardData } from "@/lib/admin-queries";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const data = await getDashboardData();

  return <DashboardClient data={data} />;
}
