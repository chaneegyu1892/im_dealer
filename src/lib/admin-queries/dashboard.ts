import { prisma } from "../prisma";
import type {
  DashboardData,
  DashboardStats,
  CategoryCount,
} from "@/types/admin";
import {
  aggregateMonthly,
  fillDailyGaps,
  formatRelativeTime,
  kstDayStart,
  kstMonthStart,
  kstMonthsAgoStart,
} from "./shared";
import { getCalcMemberAndApplyRates } from "./quote-calc-stats";

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayStart = kstDayStart(now);
  const monthStart = kstMonthStart(now);
  // 주간 버킷은 오늘 포함 7일(마지막 버킷 = 오늘)이므로 윈도우 시작도 KST 어제가 아니라 6일 전 자정이다.
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = kstMonthsAgoStart(now, 6);

  const [
    totalVehicles,
    visibleVehicles,
    todayQuoteViews,
    todayAiSessions,
    monthlyQuotes,
    calcRates,
  ] = await Promise.all([
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { isVisible: true } }),
    prisma.explorationLog.count({
      where: { eventType: "quote_start", createdAt: { gte: todayStart } },
    }),
    prisma.recommendationLog.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.savedQuote.count({
      where: { createdAt: { gte: monthStart }, deletedAt: null },
    }),
    getCalcMemberAndApplyRates(monthStart),
  ]);

  const stats: DashboardStats = {
    totalVehicles,
    visibleVehicles,
    todayQuoteViews,
    todayAiSessions,
    monthlyQuotes,
    memberRatio: calcRates.memberRatio,
    applyClickRate: calcRates.applyClickRate,
  };

  const weeklyQuoteRows = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT TO_CHAR("createdAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
    FROM "ExplorationLog"
    WHERE "eventType" = 'quote_start' AND "createdAt" >= ${weekStart}
    GROUP BY day
    ORDER BY day
  `;
  const weeklyQuoteViews = fillDailyGaps(weeklyQuoteRows, weekStart, 7);

  const weeklyAiRows = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT TO_CHAR("createdAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
    FROM "RecommendationLog"
    WHERE "createdAt" >= ${weekStart}
    GROUP BY day
    ORDER BY day
  `;
  const weeklyAiSessions = fillDailyGaps(weeklyAiRows, weekStart, 7);

  const categoryGroups = await prisma.vehicle.groupBy({
    by: ["category"],
    _count: { id: true },
  });
  const categoryDistribution: CategoryCount[] = categoryGroups.map((g) => ({
    category: g.category,
    count: g._count.id,
  }));

  const monthlyQuoteLogs = await prisma.savedQuote.findMany({
    where: { createdAt: { gte: sixMonthsAgo }, deletedAt: null },
    select: { createdAt: true },
  });
  const monthlySavedQuotes = aggregateMonthly(monthlyQuoteLogs.map((q) => q.createdAt));

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
