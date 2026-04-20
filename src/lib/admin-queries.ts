import { prisma } from "./prisma";
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

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    customerType: r.customerType,
    licenseVerified: r.licenseVerified,
    insuranceVerified: r.insuranceVerified,
    bizVerified: r.bizVerified,
    licenseData: r.licenseData as Record<string, unknown> | null,
    insuranceData: r.insuranceData as Record<string, unknown> | null,
    bizData: r.bizData as Record<string, unknown> | null,
    consentedAt: r.consentedAt,
    verifiedAt: r.verifiedAt,
    createdAt: r.createdAt,
  }));
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
    orderBy: { brand: "asc" },
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
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.savedQuote.count(),
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

  const data: AdminSavedQuote[] = quotes.map((q) => {
    const vehicle = vehicleMap.get(q.vehicleId);
    const trim = trimMap.get(q.trimId);
    return {
      id: q.id,
      sessionId: q.sessionId,
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
      createdAt: q.createdAt.toISOString(),
    };
  });

  return { data, total };
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
