import { prisma } from "../prisma";
import type { AnalyticsData, ColorPopularityItem } from "@/types/admin";
import { fillDailyGaps, kstDayStart } from "./shared";
import {
  getCalcConditionDistribution,
  getCalcPopularVehicles,
} from "./quote-calc-stats";
import { getDeliveryGateFunnel } from "./delivery-gate-funnel";

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
  // 30일 버킷은 오늘(KST)로 끝난다: [29일 전 자정 .. 오늘]
  const thirtyDaysAgo = new Date(kstDayStart(now).getTime() - 29 * 24 * 60 * 60 * 1000);

  const totalQuoteViews = await prisma.explorationLog.count({
    where: { eventType: "quote_start", createdAt: { gte: thirtyDaysAgo } },
  });
  // groupBy → length 는 세션 행 전체를 전송하므로 COUNT(DISTINCT) 로 대체한다.
  const visitorRows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT "sessionId")::bigint AS count
    FROM "ExplorationLog"
    WHERE "createdAt" >= ${thirtyDaysAgo}
  `;
  const totalVisitors = Number(visitorRows[0]?.count ?? 0);

  const dailyRows = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT TO_CHAR("createdAt" AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
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
    deliveryGateFunnel,
  ] = await Promise.all([
    getCalcPopularVehicles(thirtyDaysAgo, 10),
    getCalcConditionDistribution(thirtyDaysAgo),
    getTopColors("EXTERIOR", thirtyDaysAgo, 5),
    getTopColors("INTERIOR", thirtyDaysAgo, 5),
    getDeliveryGateFunnel(thirtyDaysAgo),
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
    deliveryGateFunnel,
  };
}
