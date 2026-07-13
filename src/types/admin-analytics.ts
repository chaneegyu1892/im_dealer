export interface DailyCount {
  date: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface DashboardStats {
  totalVehicles: number;
  visibleVehicles: number;
  todayQuoteViews: number;
  todayAiSessions: number;
  monthlyQuotes: number;
  /** 이달 견적 계산 중 회원(userId 있음) 비율 (%) */
  memberRatio: number;
  /** 이달 견적 계산 → 신청 클릭 전환율 (%) */
  applyClickRate: number;
}

export interface DashboardData {
  stats: DashboardStats;
  weeklyQuoteViews: DailyCount[];
  weeklyAiSessions: DailyCount[];
  categoryDistribution: CategoryCount[];
  monthlySavedQuotes: { month: string; count: number }[];
  topVehicles: { name: string; views: number }[];
  recentActivity: { text: string; time: string; type: string }[];
}

export interface ColorPopularityItem {
  colorId: string;
  name: string;
  hexCode: string;
  count: number;
}

export interface AnalyticsData {
  totalQuoteViews: number;
  totalVisitors: number;
  dailyTrend: DailyCount[];
  vehicleLeaderboard: { vehicleId: string; name: string; count: number }[];
  engineTypeDistribution: { engineType: string; count: number }[];
  /** QuoteCalcLog 기반 인기 차량 TOP 10 (기간: 30일) */
  calcPopularVehicles: { vehicleId: string; name: string; count: number }[];
  /** 계약조건 분포 (30일) */
  calcConditionDistribution: {
    months: CategoryCount[];
    mileages: CategoryCount[];
    depositPrepayMix: CategoryCount[];
  };
  /** 인기 외장 색상 TOP 5 (SavedQuote 기반, 30일) */
  topExteriorColors: ColorPopularityItem[];
  /** 인기 내장 색상 TOP 5 */
  topInteriorColors: ColorPopularityItem[];
}

export interface VehicleQuoteStats {
  totalCount: number;
  avgMonthly: number;
  memberRatio: number;
  applyClickRate: number;
  dailyTrend: DailyCount[];
  topTrims: { label: string; value: number }[];
  topOptions: { label: string; value: number }[];
  conditionDistribution: {
    months: CategoryCount[];
    mileages: CategoryCount[];
    depositPrepayMix: CategoryCount[];
  };
}
