import { Prisma } from "@prisma/client";
import type { VehicleQuoteStats } from "@/types/admin";
import { prisma } from "../prisma";
import { getCalcConditionDistribution } from "./quote-calc-stats";
import { fillDailyGaps } from "./shared";

export async function getVehicleQuoteStats(
  vehicleId: string,
  since: Date | null
): Promise<VehicleQuoteStats> {
  const where: { vehicleId: string; createdAt?: { gte: Date } } = { vehicleId };
  if (since) where.createdAt = { gte: since };
  const sinceClause = since
    ? Prisma.sql`AND "createdAt" >= ${since}`
    : Prisma.empty;

  const [aggRows, dailyRows, trimGroups, optionRows, conditionDistribution] =
    await Promise.all([
      prisma.$queryRaw<
        {
          total: bigint;
          members: bigint;
          applies: bigint;
          avgMonthly: number | null;
        }[]
      >`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE "userId" IS NOT NULL)::bigint AS members,
          COUNT(*) FILTER (WHERE "clickedApply" = true)::bigint AS applies,
          AVG("resultMonthly")::float AS "avgMonthly"
        FROM "QuoteCalcLog"
        WHERE "vehicleId" = ${vehicleId} ${sinceClause}
      `,
      since
        ? prisma.$queryRaw<{ day: Date; count: bigint }[]>`
            SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::bigint AS count
            FROM "QuoteCalcLog"
            WHERE "vehicleId" = ${vehicleId} AND "createdAt" >= ${since}
            GROUP BY day
            ORDER BY day
          `
        : Promise.resolve([] as { day: Date; count: bigint }[]),
      prisma.quoteCalcLog.groupBy({
        by: ["trimId"],
        where: { ...where, trimId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { trimId: "desc" } },
        take: 5,
      }),
      prisma.$queryRaw<{ optionId: string; count: bigint }[]>`
        SELECT unnested AS "optionId", COUNT(*)::bigint AS count
        FROM (
          SELECT unnest("optionIds") AS unnested
          FROM "QuoteCalcLog"
          WHERE "vehicleId" = ${vehicleId} ${sinceClause}
        ) t
        GROUP BY unnested
        ORDER BY count DESC
        LIMIT 5
      `,
      getCalcConditionDistribution(since, vehicleId),
    ]);

  const aggregate = aggRows[0];
  const total = aggregate ? Number(aggregate.total) : 0;
  const memberRatio = total > 0 && aggregate
    ? (Number(aggregate.members) / total) * 100
    : 0;
  const applyClickRate = total > 0 && aggregate
    ? (Number(aggregate.applies) / total) * 100
    : 0;
  const avgMonthly = aggregate?.avgMonthly ? Math.round(aggregate.avgMonthly) : 0;
  const dailyTrend = since
    ? fillDailyGaps(
        dailyRows,
        since,
        Math.ceil((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000))
      )
    : [];
  const trimGroupsWithId = trimGroups.filter(
    (group): group is typeof group & { trimId: string } => group.trimId !== null
  );
  const trimIds = trimGroupsWithId.map((group) => group.trimId);
  const trims = trimIds.length
    ? await prisma.trim.findMany({
        where: { id: { in: trimIds } },
        select: { id: true, name: true },
      })
    : [];
  const trimNameMap = new Map(trims.map((trim) => [trim.id, trim.name]));
  const topTrims = trimGroupsWithId.map((group) => ({
    label: trimNameMap.get(group.trimId) ?? "기타",
    value: group._count._all,
  }));
  const optionIds = optionRows.map((row) => row.optionId);
  const options = optionIds.length
    ? await prisma.trimOption.findMany({
        where: { id: { in: optionIds } },
        select: { id: true, name: true },
      })
    : [];
  const optionNameMap = new Map(options.map((option) => [option.id, option.name]));
  const topOptions = optionRows.map((row) => ({
    label: optionNameMap.get(row.optionId) ?? "(삭제됨)",
    value: Number(row.count),
  }));

  return {
    totalCount: total,
    avgMonthly,
    memberRatio,
    applyClickRate,
    dailyTrend,
    topTrims,
    topOptions,
    conditionDistribution,
  };
}
