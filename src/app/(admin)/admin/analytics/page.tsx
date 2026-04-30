import { AnalyticsDashboard } from "@/components/admin/analytics/AnalyticsDashboard";
import { getAnalyticsData } from "@/lib/admin-queries";

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return <AnalyticsDashboard data={data} />;
}
