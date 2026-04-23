import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/admin/analytics/AnalyticsDashboard";
import { getAdminSession } from "@/lib/admin-auth";
import { getAnalyticsData } from "@/lib/admin-queries";

export default async function AnalyticsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const data = await getAnalyticsData();

  return <AnalyticsDashboard data={data} />;
}
