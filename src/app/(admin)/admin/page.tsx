import { DashboardClient } from "@/components/admin/dashboard/DashboardClient";
import { getDashboardData } from "@/lib/admin-queries";

export default async function AdminDashboardPage() {
  const data = await getDashboardData();

  return <DashboardClient data={data} />;
}
