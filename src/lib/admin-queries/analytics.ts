import { prisma } from "../prisma";
import type { AnalyticsData } from "@/types/admin";
import { fillDailyGaps } from "./shared";

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

  const dailyRows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
    FROM "ExplorationLog"
    WHERE "eventType" = 'quote_view' AND "createdAt" >= ${thirtyDaysAgo}
    GROUP BY day
    ORDER BY day
  `;
  const dailyTrend = fillDailyGaps(dailyRows, thirtyDaysAgo, 30);

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
