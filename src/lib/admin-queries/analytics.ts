import { prisma } from "../prisma";
import type { AnalyticsData, ColorPopularityItem } from "@/types/admin";
import { fillDailyGaps } from "./shared";
import {
  getCalcConditionDistribution,
  getCalcPopularVehicles,
} from "./quote-calc-stats";

async function getTopColors(
  kind: "EXTERIOR" | "INTERIOR",
  since: Date,
  limit = 5
): Promise<ColorPopularityItem[]> {
  const groups = await prisma.savedQuote.groupBy({
    by: kind === "EXTERIOR" ? ["exteriorColorId"] : ["interiorColorId"],
    where: {
      deletedAt: null,
      createdAt: { gte: since },
      ...(kind === "EXTERIOR"
        ? { exteriorColorId: { not: null } }
        : { interiorColorId: { not: null } }),
    },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  const ids = groups
    .map((g) => (kind === "EXTERIOR" ? g.exteriorColorId : g.interiorColorId))
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const colors = await prisma.vehicleColor.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, hexCode: true },
  });
  const map = new Map(colors.map((c) => [c.id, c]));

  return groups
    .map((g) => {
      const id = kind === "EXTERIOR" ? g.exteriorColorId : g.interiorColorId;
      if (!id) return null;
      const c = map.get(id);
      if (!c) return null;
      return {
        colorId: id,
        name: c.name,
        hexCode: c.hexCode,
        count: g._count._all,
      };
    })
    .filter((v): v is ColorPopularityItem => v !== null);
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalQuoteViews, totalVisitors] = await Promise.all([
    prisma.explorationLog.count({
      where: { eventType: "quote_start", createdAt: { gte: thirtyDaysAgo } },
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
    WHERE "eventType" = 'quote_start' AND "createdAt" >= ${thirtyDaysAgo}
    GROUP BY day
    ORDER BY day
  `;
  const dailyTrend = fillDailyGaps(dailyRows, thirtyDaysAgo, 30);

  const vehicleLogs = await prisma.explorationLog.groupBy({
    by: ["vehicleId"],
    where: {
      vehicleId: { not: null },
      eventType: "quote_start",
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

  const [
    calcPopularVehicles,
    calcConditionDistribution,
    topExteriorColors,
    topInteriorColors,
  ] = await Promise.all([
    getCalcPopularVehicles(thirtyDaysAgo, 10),
    getCalcConditionDistribution(thirtyDaysAgo),
    getTopColors("EXTERIOR", thirtyDaysAgo, 5),
    getTopColors("INTERIOR", thirtyDaysAgo, 5),
  ]);

  return {
    totalQuoteViews,
    totalVisitors,
    dailyTrend,
    vehicleLeaderboard,
    engineTypeDistribution,
    calcPopularVehicles,
    calcConditionDistribution,
    topExteriorColors,
    topInteriorColors,
  };
}
