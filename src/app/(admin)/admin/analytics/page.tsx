import { getAnalyticsData } from "@/lib/admin-queries";
import { AnalyticsDashboard } from "@/components/admin/analytics/AnalyticsDashboard";

export default async function AdminAnalyticsPage() {
  const data = await getAnalyticsData();
  return <AnalyticsDashboard data={data} />;
}
