import type { VehicleCategory, EngineType } from "./vehicle";

// ─── Admin Vehicle (public보다 전체 필드 포함) ──────────
export interface AdminVehicle {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  vehicleCode: string | null;
  basePrice: number;
  thumbnailUrl: string;
  imageUrls: string[];
  surchargeRate: number;
  isVisible: boolean;
  isPopular: boolean;
  isSpotlight: boolean;
  displayOrder: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { trims: number };
}

export interface AdminVehicleDetail extends AdminVehicle {
  trims: AdminTrim[];
  lineups: AdminVehicleLineup[];
  popularConfigs?: AdminPopularConfig[];
  colors?: AdminVehicleColor[];
}

// ─── VehicleColor ───────────────────────────────────────
export type ColorKind = "EXTERIOR" | "INTERIOR";

export interface AdminVehicleColor {
  id: string;
  vehicleId: string;
  kind: ColorKind;
  name: string;
  hexCode: string;
  imageUrl: string | null;
  priceDelta: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── PopularConfig ──────────────────────────────────────
export interface AdminPopularConfigItem {
  id: string;
  configId: string;
  name: string;
  price: number;
  trimOptionId: string | null;
  displayOrder: number;
}

export interface AdminPopularConfig {
  id: string;
  vehicleId: string;
  name: string;
  note: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: AdminPopularConfigItem[];
}

export interface AdminVehicleLineup {
  id: string;
  vehicleId: string;
  name: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTrim {
  id: string;
  vehicleId: string;
  lineupId: string | null;
  name: string;
  price: number;
  discountPrice: number | null;
  /** 전기차 보조금(안내용, 견적 미반영). null = 보조금 없음 */
  evSubsidy: number | null;
  engineType: EngineType;
  fuelEfficiency: number | null;
  isDefault: boolean;
  isVisible: boolean;
  specs: Record<string, string> | null;
  options: AdminTrimOption[];
  rules: AdminOptionRule[];
}

export interface AdminOptionRule {
  id: string;
  trimId: string;
  ruleType: "REQUIRED" | "INCLUDED" | "CONFLICT";
  sourceOptionId: string;
  targetOptionId: string;
  createdAt: string;
}

export interface AdminTrimOption {
  id: string;
  trimId: string;
  name: string;
  price: number;
  category: string | null;
  isDefault: boolean;
  isAccessory: boolean;
  description: string | null;
  displayOrder: number;
  badgeId: string | null;
  badge: { id: string; label: string } | null;
}

// ─── OptionBadge (추천 배지 라벨) ────────────────────────
export interface AdminOptionBadge {
  id: string;
  label: string;
  displayOrder: number;
}

// ─── Brand ──────────────────────────────────────────────
export interface AdminBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  displayOrder: number;
  isFeatured: boolean;
  vehicleCount: number;
}

// ─── Dashboard ──────────────────────────────────────────
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

export interface DailyCount {
  date: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
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

// ─── Analytics ──────────────────────────────────────────
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

// ─── QuoteCalcLog 기반 차량별 통계 (P1 차량 상세 탭) ──────
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

// ─── SavedQuote (admin 조회용) ──────────────────────────
export type QuoteCrmStatus = "NEW" | "CONTACTED" | "IN_PROGRESS" | "CONVERTED" | "LOST";

export interface AdminSavedQuote {
  id: string;
  sessionId: string;
  userId: string | null;
  customerName: string | null;
  phone: string | null;
  vehicleId: string;
  vehicleName: string;
  vehicleBrand: string;
  trimId: string;
  trimName: string;
  contractMonths: number;
  annualMileage: number;
  depositRate: number;
  prepayRate: number;
  contractType: string;
  monthlyPayment: number;
  totalCost: number;
  status: "NEW" | "CONTACTED" | "IN_PROGRESS" | "CONVERTED" | "LOST";
  internalMemo: string | null;
  userType: "Member" | "Guest";
  quoteType: "AI" | "DETAIL";
  createdAt: string;
  updatedAt: string;
  exteriorColorName: string | null;
  exteriorColorHex: string | null;
  interiorColorName: string | null;
  interiorColorHex: string | null;
}

export interface AdminNotification {
  id: string;
  type: "NEW_QUOTE" | "SYSTEM" | "INQUIRY";
  title: string;
  content: string;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
  // CRM
  status: QuoteCrmStatus;
  assigneeId: string | null;
  internalMemo: string | null;
}

// ─── CapitalRateSheet (주별 캐피탈사 견적 회수율) ─────────

/** 9개 조합 키: "36_10000" | "36_20000" | ... | "60_30000" */
export type RateSheetKey =
  | "36_10000" | "36_20000" | "36_30000"
  | "48_10000" | "48_20000" | "48_30000"
  | "60_10000" | "60_20000" | "60_30000";

export type RateSheetRaw = Record<RateSheetKey, number>;

export interface CapitalRateSheet {
  id: string;
  financeCompanyId: string;
  financeCompanyName: string;
  trimId: string;
  trimName: string;
  vehicleName: string;
  lineupName: string | null;
  productType: string;
  weekOf: string;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minBaseRates: RateSheetRaw;
  minDepositRates: RateSheetRaw;
  minPrepayRates: RateSheetRaw;
  maxBaseRates: RateSheetRaw;
  maxDepositRates: RateSheetRaw;
  maxPrepayRates: RateSheetRaw;
  minRateMatrix: RateSheetRaw;
  maxRateMatrix: RateSheetRaw;
  depositDiscountRate: number;
  prepayAdjustRate: number;
  isActive: boolean;
  memo: string | null;
  createdAt: string;
}

export interface CapitalRateSheetInput {
  financeCompanyId: string;
  trimId: string;
  productType?: string;
  weekOf: string;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minBaseRates: RateSheetRaw;
  minDepositRates: RateSheetRaw;
  minPrepayRates: RateSheetRaw;
  maxBaseRates: RateSheetRaw;
  maxDepositRates: RateSheetRaw;
  maxPrepayRates: RateSheetRaw;
  memo?: string;
}

export interface AdminFinanceCompany {
  id: string;
  name: string;
  code: string;
  surchargeRate: number;
  logoUrl: string | null;
  isActive: boolean;
  displayOrder: number;
}

// ─── Inventory (재고 관리) ──────────────────────────────
export interface AdminInventory {
  id: string;
  trimId: string;
  vehicleName: string;
  trimName: string;
  stockCount: number;
  location: string | null;
  status: "AVAILABLE" | "RESERVED" | "SOLD";
  colorExt: string | null;
  colorInt: string | null;
  vin: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}
