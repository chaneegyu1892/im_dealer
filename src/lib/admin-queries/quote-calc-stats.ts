import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { CategoryCount } from "@/types/admin";

export type CalcPeriod = "7d" | "30d" | "all";

export function periodToSince(period: CalcPeriod): Date | null {
  const now = Date.now();
  if (period === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

interface PopularVehicle {
  vehicleId: string;
  name: string;
  count: number;
}

/** 인기 차량 TOP N (QuoteCalcLog 기준) */
export async function getCalcPopularVehicles(
  since: Date | null,
  take = 10
): Promise<PopularVehicle[]> {
  const where = since ? { createdAt: { gte: since } } : {};

  const groups = await prisma.quoteCalcLog.groupBy({
    by: ["vehicleId"],
    where,
    _count: { _all: true },
    orderBy: { _count: { vehicleId: "desc" } },
    take,
  });

  if (groups.length === 0) return [];

  const ids = groups.map((g) => g.vehicleId);

  // 스냅샷 vehicleName 우선 (가장 최근 값) → 비어있으면 Vehicle 조인 fallback
  const snapshotRows = await prisma.$queryRaw<
    { vehicleId: string; vehicleName: string | null }[]
  >`
    SELECT DISTINCT ON ("vehicleId") "vehicleId", "vehicleName"
    FROM "QuoteCalcLog"
    WHERE "vehicleId" = ANY(${ids})
    ORDER BY "vehicleId", "createdAt" DESC
  `;
  const snapshotMap = new Map(snapshotRows.map((r) => [r.vehicleId, r.vehicleName]));

  const fallbackVehicles = await prisma.vehicle.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, brand: true },
  });
  const fallbackMap = new Map(
    fallbackVehicles.map((v) => [v.id, `${v.brand} ${v.name}`])
  );

  return groups.map((g) => ({
    vehicleId: g.vehicleId,
    // Vehicle 우선 (브랜드+이름 표시), 차량 삭제 시 스냅샷, 그래도 없으면 "알 수 없음"
    name:
      fallbackMap.get(g.vehicleId) ||
      snapshotMap.get(g.vehicleId) ||
      "알 수 없음",
    count: g._count._all,
  }));
}

/** 회원 비율 + 신청 클릭률 (단일 쿼리로 효율) */
export async function getCalcMemberAndApplyRates(since: Date): Promise<{
  total: number;
  memberRatio: number;
  applyClickRate: number;
}> {
  const rows = await prisma.$queryRaw<
    { total: bigint; members: bigint; applies: bigint }[]
  >`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "userId" IS NOT NULL)::bigint AS members,
      COUNT(*) FILTER (WHERE "clickedApply" = true)::bigint AS applies
    FROM "QuoteCalcLog"
    WHERE "createdAt" >= ${since}
  `;
  const row = rows[0];
  const total = row ? Number(row.total) : 0;
  if (total === 0) return { total: 0, memberRatio: 0, applyClickRate: 0 };

  return {
    total,
    memberRatio: (Number(row.members) / total) * 100,
    applyClickRate: (Number(row.applies) / total) * 100,
  };
}

/** 계약조건 분포 (개월/주행거리/보증금·선납금 mix) */
export async function getCalcConditionDistribution(
  since: Date | null,
  vehicleId?: string
): Promise<{
  months: CategoryCount[];
  mileages: CategoryCount[];
  depositPrepayMix: CategoryCount[];
}> {
  const where: { createdAt?: { gte: Date }; vehicleId?: string } = {};
  if (since) where.createdAt = { gte: since };
  if (vehicleId) where.vehicleId = vehicleId;

  const [monthGroups, mileageGroups, mixRows] = await Promise.all([
    prisma.quoteCalcLog.groupBy({
      by: ["contractMonths"],
      where,
      _count: { _all: true },
      orderBy: { contractMonths: "asc" },
    }),
    prisma.quoteCalcLog.groupBy({
      by: ["annualMileage"],
      where,
      _count: { _all: true },
      orderBy: { annualMileage: "asc" },
    }),
    (() => {
      const conditions: Prisma.Sql[] = [];
      if (since) conditions.push(Prisma.sql`"createdAt" >= ${since}`);
      if (vehicleId) conditions.push(Prisma.sql`"vehicleId" = ${vehicleId}`);
      const whereClause = conditions.length
        ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
        : Prisma.empty;
      return prisma.$queryRaw<{ category: string; count: bigint }[]>`
        SELECT
          CASE
            WHEN "depositRate" > 0 THEN '보증금'
            WHEN "prepayRate" > 0 THEN '선납금'
            ELSE '기본'
          END AS category,
          COUNT(*)::bigint AS count
        FROM "QuoteCalcLog"
        ${whereClause}
        GROUP BY category
      `;
    })(),
  ]);

  return {
    months: monthGroups.map((g) => ({
      category: `${g.contractMonths}개월`,
      count: g._count._all,
    })),
    mileages: mileageGroups.map((g) => ({
      category: `${(g.annualMileage / 10000).toFixed(0)}만km`,
      count: g._count._all,
    })),
    depositPrepayMix: mixRows.map((r) => ({
      category: r.category,
      count: Number(r.count),
    })),
  };
}
