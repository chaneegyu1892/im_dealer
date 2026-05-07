import { prisma } from "../prisma";
import type {
  DashboardData,
  DashboardStats,
  CategoryCount,
} from "@/types/admin";
import { aggregateMonthly, fillDailyGaps, formatRelativeTime } from "./shared";
import { getCalcMemberAndApplyRates } from "./quote-calc-stats";

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

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
      where: { eventType: "quote_view", createdAt: { gte: todayStart } },
    }),
    prisma.recommendationLog.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.savedQuote.count({
      where: { createdAt: { gte: monthStart } },
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

  const weeklyQuoteRows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM "ExplorationLog"
    WHERE "eventType" = 'quote_view' AND "createdAt" >= ${weekAgo}
    GROUP BY day
    ORDER BY day
  `;
  const weeklyQuoteViews = fillDailyGaps(weeklyQuoteRows, weekAgo, 7);

  const weeklyAiRows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM "RecommendationLog"
    WHERE "createdAt" >= ${weekAgo}
    GROUP BY day
    ORDER BY day
  `;
  const weeklyAiSessions = fillDailyGaps(weeklyAiRows, weekAgo, 7);

  const categoryGroups = await prisma.vehicle.groupBy({
    by: ["category"],
    _count: { id: true },
  });
  const categoryDistribution: CategoryCount[] = categoryGroups.map((g) => ({
    category: g.category,
    count: g._count.id,
  }));

  const monthlyQuoteLogs = await prisma.savedQuote.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
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
