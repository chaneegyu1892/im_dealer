import { getDashboardData } from "@/lib/admin-queries";
import { DashboardClient } from "@/components/admin/dashboard/DashboardClient";

export default async function AdminDashboard() {
  const data = await getDashboardData();
  return <DashboardClient data={data} />;
}
