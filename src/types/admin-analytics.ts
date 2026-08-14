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

/** 견적서 받기 로그인 게이트 퍼널 (세션 단위, 30일) */
export interface DeliveryGateFunnel {
  /** 회원 견적 산출 세션 수 — userId 있고 게이트를 보지 않은 세션 */
  memberCalculated: number;
  /** 비회원 견적 산출 세션 수 — userId 없거나 게이트를 본 세션 */
  guestCalculated: number;
  /** 비회원이 견적서 받기를 눌러 게이트가 표시된 세션 수 */
  gateShown: number;
  /** 게이트에서 카카오 로그인을 클릭한 세션 수 */
  loginClicked: number;
  /** 게이트 표시 세션 중 최종 전환(clickedApply)까지 이어진 세션 수 */
  converted: number;
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
  /** 견적서 받기 로그인 게이트 퍼널 (30일) */
  deliveryGateFunnel: DeliveryGateFunnel;
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
