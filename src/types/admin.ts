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
  displayOrder: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { trims: number };
}

export interface AdminVehicleDetail extends AdminVehicle {
  trims: AdminTrim[];
  lineups: AdminVehicleLineup[];
}

export interface AdminVehicleLineup {
  id: string;
  vehicleId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTrim {
  id: string;
  vehicleId: string;
  lineupId: string | null;
  name: string;
  price: number;
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
}

// ─── Brand (Vehicle.brand DISTINCT 집계) ────────────────
export interface AdminBrand {
  name: string;
  vehicleCount: number;
}

// ─── Dashboard ──────────────────────────────────────────
export interface DashboardStats {
  totalVehicles: number;
  visibleVehicles: number;
  todayQuoteViews: number;
  todayAiSessions: number;
  monthlyQuotes: number;
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
export interface AnalyticsData {
  totalQuoteViews: number;
  totalVisitors: number;
  dailyTrend: DailyCount[];
  vehicleLeaderboard: { vehicleId: string; name: string; count: number }[];
  engineTypeDistribution: { engineType: string; count: number }[];
}

// ─── SavedQuote (admin 조회용) ──────────────────────────
export type QuoteCrmStatus = "NEW" | "CONTACTED" | "IN_PROGRESS" | "CONVERTED" | "LOST";

export interface AdminSavedQuote {
  id: string;
  sessionId: string;
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
