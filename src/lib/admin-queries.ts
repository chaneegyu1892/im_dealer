import { prisma } from "./prisma";
import { decryptVerificationRow } from "@/lib/pii";
import { supabaseAdmin } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type {
  DashboardData,
  DashboardStats,
  DailyCount,
  CategoryCount,
  AnalyticsData,
  AdminVehicle,
  AdminVehicleDetail,
  AdminBrand,
  AdminSavedQuote,
  AdminOptionRule,
  AdminInventory,
  CapitalRateSheet,
  AdminFinanceCompany,
  RateSheetRaw,
} from "@/types/admin";

// ─── 서류 인증 목록 (admin) ─────────────────────────────
export interface AdminVerification {
  id: string;
  sessionId: string;
  customerType: string;
  licenseVerified: boolean;
  insuranceVerified: boolean;
  bizVerified: boolean;
  licenseData: Record<string, unknown> | null;
  insuranceData: Record<string, unknown> | null;
  bizData: Record<string, unknown> | null;
  consentedAt: Date;
  verifiedAt: Date | null;
  createdAt: Date;
}

export async function getRecentVerifications(take = 50): Promise<AdminVerification[]> {
  const rows = await prisma.customerVerification.findMany({
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((r) => {
    const decrypted = decryptVerificationRow(r);
    return {
      id: r.id,
      sessionId: r.sessionId,
      customerType: r.customerType,
      licenseVerified: r.licenseVerified,
      insuranceVerified: r.insuranceVerified,
      bizVerified: r.bizVerified,
      licenseData: decrypted.licenseData as Record<string, unknown> | null,
      insuranceData: decrypted.insuranceData as Record<string, unknown> | null,
      bizData: decrypted.bizData as Record<string, unknown> | null,
      consentedAt: r.consentedAt,
      verifiedAt: r.verifiedAt,
      createdAt: r.createdAt,
    };
  });
}

// ─── 차량 목록 (admin) ──────────────────────────────────
export async function getAdminVehicles(brand?: string): Promise<AdminVehicle[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: brand ? { brand } : undefined,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { trims: true } } },
  });

  return vehicles.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    brand: v.brand,
    category: v.category as AdminVehicle["category"],
    vehicleCode: v.vehicleCode,
    basePrice: v.basePrice,
    thumbnailUrl: v.thumbnailUrl,
    imageUrls: v.imageUrls,
    surchargeRate: v.surchargeRate,
    isVisible: v.isVisible,
    isPopular: v.isPopular,
    displayOrder: v.displayOrder,
    description: v.description,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    _count: v._count,
  }));
}

// ─── 차량 상세 (트림+옵션 포함) ─────────────────────────
export async function getVehicleById(id: string): Promise<AdminVehicleDetail | null> {
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      lineups: {
        orderBy: { createdAt: "asc" },
      },
      trims: {
        orderBy: [{ isDefault: "desc" }, { price: "asc" }],
        include: {
          options: { orderBy: { price: "asc" } },
          rules: true,
        },
      },
    },
  });

  if (!v) return null;

  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    brand: v.brand,
    category: v.category as AdminVehicleDetail["category"],
    vehicleCode: v.vehicleCode,
    basePrice: v.basePrice,
    thumbnailUrl: v.thumbnailUrl,
    imageUrls: v.imageUrls,
    surchargeRate: v.surchargeRate,
    isVisible: v.isVisible,
    isPopular: v.isPopular,
    displayOrder: v.displayOrder,
    description: v.description,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    lineups: v.lineups.map((l) => ({
      id: l.id,
      vehicleId: l.vehicleId,
      name: l.name,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
    trims: v.trims.map((t) => ({
      id: t.id,
      vehicleId: t.vehicleId,
      lineupId: t.lineupId,
      name: t.name,
      price: t.price,
      engineType: t.engineType as AdminVehicleDetail["trims"][number]["engineType"],
      fuelEfficiency: t.fuelEfficiency,
      isDefault: t.isDefault,
      isVisible: t.isVisible,
      specs: t.specs as Record<string, string> | null,
      options: t.options.map((o) => ({
        id: o.id,
        trimId: o.trimId,
        name: o.name,
        price: o.price,
        category: o.category,
        isDefault: o.isDefault,
        isAccessory: o.isAccessory,
        description: o.description,
      })),
      rules: t.rules.map((r) => ({
        id: r.id,
        trimId: r.trimId,
        ruleType: r.ruleType as AdminOptionRule["ruleType"],
        sourceOptionId: r.sourceOptionId,
        targetOptionId: r.targetOptionId,
        createdAt: r.createdAt.toISOString(),
      })),
    })),
  };
}

// ─── 브랜드 목록 (DISTINCT) ─────────────────────────────
export async function getAdminBrands(): Promise<AdminBrand[]> {
  const groups = await prisma.vehicle.groupBy({
    by: ["brand"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return groups.map((g) => ({
    name: g.brand,
    vehicleCount: g._count.id,
  }));
}

// ─── 대시보드 데이터 ────────────────────────────────────
export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  // KPI 통계 (병렬 실행)
  const [totalVehicles, visibleVehicles, todayQuoteViews, todayAiSessions, monthlyQuotes] =
    await Promise.all([
      prisma.vehicle.count(),
      prisma.vehicle.count({ where: { isVisible: true } }),
      prisma.explorationLog.count({
        where: { eventType: "quote_view", createdAt: { gte: todayStart } },
      }),
      prisma.recommendationLog.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.savedQuote.count({
        where: { createdAt: { gte: monthStart } },
      }),
    ]);

  const stats: DashboardStats = {
    totalVehicles,
    visibleVehicles,
    todayQuoteViews,
    todayAiSessions,
    monthlyQuotes,
  };

  // 주간 견적 조회 추이
  const weeklyQuoteLogs = await prisma.explorationLog.groupBy({
    by: ["createdAt"],
    where: { eventType: "quote_view", createdAt: { gte: weekAgo } },
    _count: { id: true },
  });
  const weeklyQuoteViews = aggregateDailyFromGroupBy(weeklyQuoteLogs, weekAgo, 7);

  // 주간 AI 추천 세션
  const weeklyAiLogs = await prisma.recommendationLog.groupBy({
    by: ["createdAt"],
    where: { createdAt: { gte: weekAgo } },
    _count: { id: true },
  });
  const weeklyAiSessions = aggregateDailyFromGroupBy(weeklyAiLogs, weekAgo, 7);

  // 카테고리 분포
  const categoryGroups = await prisma.vehicle.groupBy({
    by: ["category"],
    _count: { id: true },
  });
  const categoryDistribution: CategoryCount[] = categoryGroups.map((g) => ({
    category: g.category,
    count: g._count.id,
  }));

  // 월별 SavedQuote
  const monthlyQuoteLogs = await prisma.savedQuote.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { createdAt: true },
  });
  const monthlySavedQuotes = aggregateMonthly(monthlyQuoteLogs.map((q) => q.createdAt));

  // 인기 차량 (탐색 로그 기준 Top 5)
  const topVehicleLogs = await prisma.explorationLog.groupBy({
    by: ["vehicleId"],
    where: { vehicleId: { not: null }, createdAt: { gte: monthStart } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });
  const topVehicleIds = topVehicleLogs
    .map((l) => l.vehicleId)
    .filter(Boolean) as string[];
  const topVehicleNames = await prisma.vehicle.findMany({
    where: { id: { in: topVehicleIds } },
    select: { id: true, name: true, brand: true },
  });
  const vehicleNameMap = new Map(topVehicleNames.map((v) => [v.id, `${v.brand} ${v.name}`]));
  const topVehicles = topVehicleLogs.map((l) => ({
    name: vehicleNameMap.get(l.vehicleId!) ?? "알 수 없음",
    views: l._count.id,
  }));

  // 최근 활동 (OperationalNote 최근 5개)
  const recentNotes = await prisma.operationalNote.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { vehicle: { select: { name: true } } },
  });
  const recentActivity = recentNotes.map((n) => ({
    text: n.vehicle ? `${n.vehicle.name}: ${n.content}` : n.content,
    time: formatRelativeTime(n.createdAt),
    type: n.category,
  }));

  return {
    stats,
    weeklyQuoteViews,
    weeklyAiSessions,
    categoryDistribution,
    monthlySavedQuotes,
    topVehicles,
    recentActivity,
  };
}

// ─── 분석 데이터 ────────────────────────────────────────
export async function getAnalyticsData(): Promise<AnalyticsData> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalQuoteViews, totalVisitors] = await Promise.all([
    prisma.explorationLog.count({
      where: { eventType: "quote_view", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.explorationLog
      .groupBy({
        by: ["sessionId"],
        where: { createdAt: { gte: thirtyDaysAgo } },
      })
      .then((g) => g.length),
  ]);

  // 일간 트렌드
  const dailyLogs = await prisma.explorationLog.groupBy({
    by: ["createdAt"],
    where: { eventType: "quote_view", createdAt: { gte: thirtyDaysAgo } },
    _count: { id: true },
  });
  const dailyTrend = aggregateDailyFromGroupBy(dailyLogs, thirtyDaysAgo, 30);

  // 차량별 견적 조회 수 Top 10
  const vehicleLogs = await prisma.explorationLog.groupBy({
    by: ["vehicleId"],
    where: {
      vehicleId: { not: null },
      eventType: "quote_view",
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  const vIds = vehicleLogs.map((l) => l.vehicleId).filter(Boolean) as string[];
  const vNames = await prisma.vehicle.findMany({
    where: { id: { in: vIds } },
    select: { id: true, name: true, brand: true },
  });
  const nameMap = new Map(vNames.map((v) => [v.id, `${v.brand} ${v.name}`]));
  const vehicleLeaderboard = vehicleLogs.map((l) => ({
    vehicleId: l.vehicleId!,
    name: nameMap.get(l.vehicleId!) ?? "알 수 없음",
    count: l._count.id,
  }));

  // 파워트레인 분포
  const engineGroups = await prisma.trim.groupBy({
    by: ["engineType"],
    _count: { id: true },
  });
  const engineTypeDistribution = engineGroups.map((g) => ({
    engineType: g.engineType,
    count: g._count.id,
  }));

  return {
    totalQuoteViews,
    totalVisitors,
    dailyTrend,
    vehicleLeaderboard,
    engineTypeDistribution,
  };
}

// ─── SavedQuote 목록 (admin) ────────────────────────────
export async function getAdminQuotes(page = 1, limit = 20): Promise<{
  data: AdminSavedQuote[];
  total: number;
}> {
  const skip = (page - 1) * limit;

  const [quotes, total] = await Promise.all([
    prisma.savedQuote.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.savedQuote.count({ where: { deletedAt: null } }),
  ]);

  // vehicleId, trimId에서 이름 조회
  const vehicleIds = [...new Set(quotes.map((q) => q.vehicleId))];
  const trimIds = [...new Set(quotes.map((q) => q.trimId))];

  const [vehicles, trims] = await Promise.all([
    prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true, brand: true },
    }),
    prisma.trim.findMany({
      where: { id: { in: trimIds } },
      select: { id: true, name: true },
    }),
  ]);

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
  const trimMap = new Map(trims.map((t) => [t.id, t]));

  const data: AdminSavedQuote[] = (quotes.length > 0 ? quotes : []).map((q) => {
    const vehicle = vehicleMap.get(q.vehicleId);
    const trim = trimMap.get(q.trimId);
    return {
      id: q.id,
      sessionId: q.sessionId,
      userId: q.userId,
      customerName: q.customerName,
      phone: q.phone,
      vehicleId: q.vehicleId,
      vehicleName: vehicle?.name ?? "삭제된 차량",
      vehicleBrand: vehicle?.brand ?? "",
      trimId: q.trimId,
      trimName: trim?.name ?? "삭제된 트림",
      contractMonths: q.contractMonths,
      annualMileage: q.annualMileage,
      depositRate: q.depositRate,
      prepayRate: q.prepayRate,
      contractType: q.contractType,
      monthlyPayment: q.monthlyPayment,
      totalCost: q.totalCost,
      status: q.status as AdminSavedQuote["status"],
      internalMemo: q.internalMemo,
      userType: q.userId ? "Member" : "Guest",
      quoteType: q.quoteType as AdminSavedQuote["quoteType"],
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    };
  });

  return { data, total };
}

// ─── Inventory (재고 관리) ──────────────────────────────
export interface AdminInventoryItem extends AdminInventory {}

export async function getAdminInventory(): Promise<AdminInventory[]> {
  const inventory = await prisma.inventory.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      trim: {
        include: {
          vehicle: {
            select: { name: true, brand: true },
          },
        },
      },
    },
  });

  return inventory.map((i) => ({
    id: i.id,
    trimId: i.trimId,
    vehicleName: i.trim.vehicle.name,
    trimName: i.trim.name,
    stockCount: i.stockCount,
    location: i.location,
    status: i.status as AdminInventory["status"],
    colorExt: i.colorExt,
    colorInt: i.colorInt,
    vin: i.vin,
    memo: i.memo,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));
}

// ─── 금융사 목록 ────────────────────────────────────────
export async function getAdminFinanceCompanies(): Promise<AdminFinanceCompany[]> {
  const rows = await prisma.financeCompany.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    surchargeRate: r.surchargeRate,
    isActive: r.isActive,
    displayOrder: r.displayOrder,
  }));
}

// ─── CapitalRateSheet 쿼리 ──────────────────────────────

/** 특정 캐피탈사의 최신 활성 시트 목록 */
export async function getActiveRateSheets(
  financeCompanyId: string
): Promise<CapitalRateSheet[]> {
  const db = prisma as any;
  const rows = await db.capitalRateSheet.findMany({
    where: { financeCompanyId, isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      financeCompany: { select: { name: true } },
      trim: {
        include: {
          vehicle: { select: { name: true } },
          lineup: { select: { name: true } },
        },
      },
    },
  });
  return rows.map(mapRateSheet);
}

/** 특정 트림의 이력 (주별 전체) */
export async function getRateSheetHistory(
  financeCompanyId: string,
  trimId: string
): Promise<CapitalRateSheet[]> {
  const db = prisma as any;
  const rows = await db.capitalRateSheet.findMany({
    where: { financeCompanyId, trimId },
    orderBy: { weekOf: "desc" },
    include: {
      financeCompany: { select: { name: true } },
      trim: {
        include: {
          vehicle: { select: { name: true } },
          lineup: { select: { name: true } },
        },
      },
    },
  });
  return rows.map(mapRateSheet);
}

interface RateSheetRow {
  id: string;
  financeCompanyId: string;
  trimId: string;
  weekOf: Date;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minBaseRates: unknown;
  minDepositRates: unknown;
  minPrepayRates: unknown;
  maxBaseRates: unknown;
  maxDepositRates: unknown;
  maxPrepayRates: unknown;
  minRateMatrix: unknown;
  maxRateMatrix: unknown;
  depositDiscountRate: number;
  prepayAdjustRate: number;
  isActive: boolean;
  memo: string | null;
  createdAt: Date;
  financeCompany: { name: string };
  trim: { name: string; lineup: { name: string } | null; vehicle: { name: string } };
}

function mapRateSheet(r: RateSheetRow): CapitalRateSheet {
  return {
    id: r.id,
    financeCompanyId: r.financeCompanyId,
    financeCompanyName: r.financeCompany.name,
    trimId: r.trimId,
    trimName: r.trim.name,
    vehicleName: r.trim.vehicle.name,
    lineupName: r.trim.lineup?.name ?? null,
    weekOf: r.weekOf.toISOString(),
    minVehiclePrice: r.minVehiclePrice,
    maxVehiclePrice: r.maxVehiclePrice,
    minBaseRates: r.minBaseRates as RateSheetRaw,
    minDepositRates: r.minDepositRates as RateSheetRaw,
    minPrepayRates: r.minPrepayRates as RateSheetRaw,
    maxBaseRates: r.maxBaseRates as RateSheetRaw,
    maxDepositRates: r.maxDepositRates as RateSheetRaw,
    maxPrepayRates: r.maxPrepayRates as RateSheetRaw,
    minRateMatrix: r.minRateMatrix as RateSheetRaw,
    maxRateMatrix: r.maxRateMatrix as RateSheetRaw,
    depositDiscountRate: r.depositDiscountRate,
    prepayAdjustRate: r.prepayAdjustRate,
    isActive: r.isActive,
    memo: r.memo,
    createdAt: r.createdAt.toISOString(),
  };
}

// ─── 유틸 ───────────────────────────────────────────────
function aggregateDailyFromGroupBy(
  rows: { createdAt: Date; _count: { id: number } }[],
  startDate: Date,
  days: number
): DailyCount[] {
  const dayMap = new Map<string, number>();
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    dayMap.set(key, (dayMap.get(key) ?? 0) + row._count.id);
  }

  const result: DailyCount[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: dayMap.get(key) ?? 0 });
  }
  return result;
}

function aggregateMonthly(dates: Date[]): { month: string; count: number }[] {
  const monthMap = new Map<string, number>();
  for (const d of dates) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR");
}

// ─── 사용자 관리 ─────────────────────────────────────────

export interface AdminUserActiveItem {
  quoteId: string;
  vehicleName: string;
  statusRaw: string;
  statusLabel: string;
}

export interface AdminUserContractItem {
  quoteId: string;
  vehicleName: string;
  monthlyPayment: number;
  contractMonths: number;
  startDate: string;
  expectedEndDate: string;
  lifecycleStatus: "active" | "expiring_soon" | "expired";
  lifecycleLabel: string;
}

export interface AdminUserRecord {
  id: string;                 // Supabase userId 또는 첫 번째 견적의 sessionId
  authUserId?: string | null;
  name: string;               // Supabase name 또는 customerName
  phone: string;
  email?: string | null;
  avatarUrl?: string | null;
  provider?: string | null;
  source: "member" | "lead";
  consultationCount: number;  // 총 견적 신청 건수
  contractCount: number;      // 계약 완료 처리된 견적 건수
  expiringSoonCount: number;  // 예상 만기 90일 이내 계약 건수
  firstContactAt: string;     // 첫 견적 생성일 (ISO)
  lastContactAt: string;      // 최근 견적 생성일 (ISO)
  userStatus: "active" | "dormant";
  activeItems: AdminUserActiveItem[];
  contractItems: AdminUserContractItem[];
  internalMemo: string | null;
}

export interface AdminUsersStats {
  total: number;
  active: number;
  dormant: number;
  newThisMonth: number;
  contracts: number;
  expiringSoon: number;
}

function mapQuoteStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: "상담대기",
    CONTACTED: "상담중",
    IN_PROGRESS: "상담중",
    CONVERTED: "계약완료",
    LOST: "계약취소",
  };
  return map[status] ?? status;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getContractLifecycle(expectedEndDate: Date): {
  lifecycleStatus: AdminUserContractItem["lifecycleStatus"];
  lifecycleLabel: string;
} {
  const today = new Date();
  const daysUntilEnd = Math.ceil(
    (expectedEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilEnd < 0) {
    return { lifecycleStatus: "expired", lifecycleLabel: "예상 만료" };
  }
  if (daysUntilEnd <= 90) {
    return { lifecycleStatus: "expiring_soon", lifecycleLabel: "만기 임박" };
  }
  return { lifecycleStatus: "active", lifecycleLabel: "계약 진행" };
}

interface SupabaseAuthUserSummary {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  provider: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  phone: string | null;
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

const UNKNOWN_PHONE = "연락처 없음";
const MISSING_PHONE_VALUES = new Set(["", UNKNOWN_PHONE, "연락처 미입력", "010-0000-0000"]);
const MISSING_NORMALIZED_PHONES = new Set(["01000000000"]);

function normalizePhone(phone: string | null | undefined) {
  return phone?.replace(/\D/g, "") ?? "";
}

function getUsablePhone(phone: string | null | undefined) {
  const raw = phone?.trim() ?? "";
  const normalized = normalizePhone(raw);

  if (MISSING_PHONE_VALUES.has(raw) || MISSING_NORMALIZED_PHONES.has(normalized) || normalized.length < 8) {
    return null;
  }

  return raw;
}

function mapSupabaseUser(user: SupabaseUser): SupabaseAuthUserSummary {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const name =
    getMetadataString(metadata, ["name", "full_name", "user_name", "nickname"]) ??
    user.email?.split("@")[0] ??
    "회원";

  return {
    id: user.id,
    name,
    email: user.email ?? null,
    avatarUrl: getMetadataString(metadata, ["avatar_url", "picture"]),
    provider: getMetadataString(appMetadata, ["provider"]),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    phone:
      user.phone ??
      getMetadataString(metadata, ["phone", "phone_number", "mobile", "mobile_phone"]),
  };
}

async function getSupabaseAuthUsers(): Promise<SupabaseAuthUserSummary[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[getAdminUsers] Supabase service role env is missing; auth users are skipped.");
    return [];
  }

  try {
    const admin = supabaseAdmin();
    const users: SupabaseAuthUserSummary[] = [];
    const perPage = 1000;

    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.warn("[getAdminUsers] Failed to list Supabase auth users:", error.message);
        return [];
      }

      const pageUsers = data.users.map(mapSupabaseUser);
      users.push(...pageUsers);

      if (pageUsers.length < perPage) break;
    }

    return users;
  } catch (error) {
    console.warn(
      "[getAdminUsers] Supabase auth user lookup failed:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

export async function getAdminUsers(): Promise<{
  users: AdminUserRecord[];
  stats: AdminUsersStats;
}> {
  const [quotes, authUsers] = await Promise.all([
    prisma.savedQuote.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sessionId: true,
        userId: true,
        vehicleId: true,
        customerName: true,
        phone: true,
        status: true,
        contractMonths: true,
        monthlyPayment: true,
        convertedAt: true,
        createdAt: true,
        updatedAt: true,
        internalMemo: true,
      },
    }),
    getSupabaseAuthUsers(),
  ]);

  // 차량 이름 조회
  const vehicleIds = [...new Set(quotes.map((q) => q.vehicleId))];
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    select: { id: true, name: true },
  });
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v.name]));

  // Supabase Auth 회원을 먼저 등록하고, SavedQuote는 userId 우선으로 병합한다.
  const userMap = new Map<string, AdminUserRecord>();
  const phoneToAuthKey = new Map<string, string>();
  const duplicateAuthPhones = new Set<string>();

  for (const authUser of authUsers) {
    const contactDate = authUser.lastSignInAt ?? authUser.createdAt;
    const authKey = `auth:${authUser.id}`;
    const authPhone = getUsablePhone(authUser.phone);

    userMap.set(authKey, {
      id: authUser.id,
      authUserId: authUser.id,
      name: authUser.name,
      phone: authPhone ?? UNKNOWN_PHONE,
      email: authUser.email,
      avatarUrl: authUser.avatarUrl,
      provider: authUser.provider,
      source: "member",
      consultationCount: 0,
      contractCount: 0,
      expiringSoonCount: 0,
      firstContactAt: authUser.createdAt,
      lastContactAt: contactDate,
      userStatus: "active",
      activeItems: [],
      contractItems: [],
      internalMemo: null,
    });

    if (authPhone) {
      const normalizedAuthPhone = normalizePhone(authPhone);
      const existingAuthKey = phoneToAuthKey.get(normalizedAuthPhone);

      if (existingAuthKey && existingAuthKey !== authKey) {
        duplicateAuthPhones.add(normalizedAuthPhone);
      } else {
        phoneToAuthKey.set(normalizedAuthPhone, authKey);
      }
    }
  }

  for (const q of quotes) {
    const quotePhone = getUsablePhone(q.phone);
    const normalizedQuotePhone = quotePhone ? normalizePhone(quotePhone) : null;
    const authKeyFromPhone =
      !q.userId && normalizedQuotePhone && !duplicateAuthPhones.has(normalizedQuotePhone)
        ? phoneToAuthKey.get(normalizedQuotePhone)
        : undefined;
    const mergeKey =
      q.userId
        ? `auth:${q.userId}`
        : authKeyFromPhone ??
          (normalizedQuotePhone ? `phone:${normalizedQuotePhone}` : `quote:${q.sessionId}`);
    const phone = quotePhone ?? UNKNOWN_PHONE;
    const name = q.customerName ?? phone;

    if (!userMap.has(mergeKey)) {
      userMap.set(mergeKey, {
        id: q.userId ?? q.sessionId,
        authUserId: q.userId,
        name,
        phone,
        email: null,
        avatarUrl: null,
        provider: null,
        source: q.userId ? "member" : "lead",
        consultationCount: 0,
        contractCount: 0,
        expiringSoonCount: 0,
        firstContactAt: q.createdAt.toISOString(),
        lastContactAt: q.createdAt.toISOString(),
        userStatus: "active",
        activeItems: [],
        contractItems: [],
        internalMemo: q.internalMemo ?? null,
      });
    }

    const user = userMap.get(mergeKey)!;
    if (q.customerName && (user.name === "회원" || user.name === user.email?.split("@")[0] || user.name === "연락처 없음")) {
      user.name = q.customerName;
    }
    if (quotePhone && user.phone === UNKNOWN_PHONE) {
      user.phone = quotePhone;
    }
    if (q.userId) {
      user.authUserId = q.userId;
    }
    if (q.userId || authKeyFromPhone) {
      user.source = "member";
    }
    user.consultationCount++;

    // 최초/최근 접수일 갱신
    if (new Date(q.createdAt) < new Date(user.firstContactAt)) {
      user.firstContactAt = q.createdAt.toISOString();
      if (user.source === "lead") {
        user.id = q.sessionId;
      }
    }
    if (new Date(q.createdAt) > new Date(user.lastContactAt)) {
      user.lastContactAt = q.createdAt.toISOString();
      if (q.internalMemo) user.internalMemo = q.internalMemo;
    }

    // 진행 항목 추가 (LOST 제외)
    if (q.status !== "LOST") {
      const vehicleName = vehicleMap.get(q.vehicleId) ?? "알 수 없음";
      user.activeItems.push({
        quoteId: q.id,
        vehicleName,
        statusRaw: q.status,
        statusLabel: mapQuoteStatusLabel(q.status),
      });

      if (q.status === "CONVERTED") {
        const startDate = q.convertedAt ?? q.updatedAt ?? q.createdAt;
        const expectedEndDate = addMonths(startDate, q.contractMonths);
        const lifecycle = getContractLifecycle(expectedEndDate);
        user.contractCount++;
        if (lifecycle.lifecycleStatus === "expiring_soon") {
          user.expiringSoonCount++;
        }
        user.contractItems.push({
          quoteId: q.id,
          vehicleName,
          monthlyPayment: q.monthlyPayment,
          contractMonths: q.contractMonths,
          startDate: startDate.toISOString(),
          expectedEndDate: expectedEndDate.toISOString(),
          ...lifecycle,
        });
      }
    }
  }

  // 30일 이상 미활동 → 휴면
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const users = [...userMap.values()].map((user) => ({
    ...user,
    userStatus:
      new Date(user.lastContactAt) < thirtyDaysAgo
        ? ("dormant" as const)
        : ("active" as const),
  }));

  // 최근 접수일 내림차순 정렬
  users.sort(
    (a, b) =>
      new Date(b.lastContactAt).getTime() - new Date(a.lastContactAt).getTime()
  );

  const stats: AdminUsersStats = {
    total: users.length,
    active: users.filter((u) => u.userStatus === "active").length,
    dormant: users.filter((u) => u.userStatus === "dormant").length,
    newThisMonth: users.filter(
      (u) => new Date(u.firstContactAt) >= thisMonthStart
    ).length,
    contracts: users.reduce((sum, u) => sum + u.contractCount, 0),
    expiringSoon: users.reduce((sum, u) => sum + u.expiringSoonCount, 0),
  };

  return { users, stats };
}

// ─── 후기 (Review) ──────────────────────────────────────
import { maskAuthorName, formatReviewDate, maskPhone } from "./review-utils";
import type {
  PublicReview,
  AdminReview,
  AdminReviewVehicleOption,
} from "@/types/review";

export async function getPublicReviews(limit = 10): Promise<PublicReview[]> {
  const rows = await prisma.review.findMany({
    where: { isPublic: true },
    orderBy: [{ displayOrder: "asc" }, { reviewDate: "desc" }],
    take: limit,
    include: { vehicle: { select: { name: true, brand: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    displayName: maskAuthorName(r.authorRealName),
    rating: r.rating,
    content: r.content,
    vehicleName: r.vehicle ? `${r.vehicle.brand} ${r.vehicle.name}` : null,
    reviewDate: formatReviewDate(r.reviewDate),
  }));
}

export async function getPublicReviewsByVehicleId(
  vehicleId: string,
  limit = 10
): Promise<PublicReview[]> {
  const rows = await prisma.review.findMany({
    where: { isPublic: true, vehicleId },
    orderBy: [{ displayOrder: "asc" }, { reviewDate: "desc" }],
    take: limit,
    include: { vehicle: { select: { name: true, brand: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    displayName: maskAuthorName(r.authorRealName),
    rating: r.rating,
    content: r.content,
    vehicleName: r.vehicle ? `${r.vehicle.brand} ${r.vehicle.name}` : null,
    reviewDate: formatReviewDate(r.reviewDate),
  }));
}

export async function getAllReviewsForAdmin(): Promise<AdminReview[]> {
  const rows = await prisma.review.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: {
      vehicle: { select: { name: true, brand: true } },
      savedQuote: {
        select: {
          customerName: true,
          phone: true,
          createdAt: true,
          vehicleId: true,
        },
      },
    },
  });

  const sqVehicleIds = Array.from(
    new Set(
      rows
        .map((r) => r.savedQuote?.vehicleId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const sqVehicles = sqVehicleIds.length
    ? await prisma.vehicle.findMany({
        where: { id: { in: sqVehicleIds } },
        select: { id: true, name: true, brand: true },
      })
    : [];
  const sqVehicleMap = new Map(sqVehicles.map((v) => [v.id, `${v.brand} ${v.name}`]));

  return rows.map((r) => ({
    id: r.id,
    authorRealName: r.authorRealName,
    displayName: maskAuthorName(r.authorRealName),
    rating: r.rating,
    content: r.content,
    vehicleId: r.vehicleId,
    vehicleName: r.vehicle ? `${r.vehicle.brand} ${r.vehicle.name}` : null,
    savedQuoteId: r.savedQuoteId,
    linkedCustomerName: r.savedQuote?.customerName ?? null,
    linkedCustomerPhoneMasked: r.savedQuote?.phone ? maskPhone(r.savedQuote.phone) : null,
    linkedQuoteVehicleName: r.savedQuote?.vehicleId
      ? sqVehicleMap.get(r.savedQuote.vehicleId) ?? null
      : null,
    linkedQuoteCreatedAt: r.savedQuote?.createdAt
      ? formatReviewDate(r.savedQuote.createdAt)
      : null,
    isPublic: r.isPublic,
    displayOrder: r.displayOrder,
    reviewDate: r.reviewDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getVehiclesForReviewSelect(): Promise<AdminReviewVehicleOption[]> {
  const rows = await prisma.vehicle.findMany({
    where: { isVisible: true },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
    select: { id: true, name: true, brand: true },
  });
  return rows;
}
