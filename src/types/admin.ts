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
}

export interface AdminTrim {
  id: string;
  vehicleId: string;
  name: string;
  price: number;
  engineType: EngineType;
  fuelEfficiency: number | null;
  isDefault: boolean;
  isVisible: boolean;
  specs: Record<string, string> | null;
  options: AdminTrimOption[];
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
}
