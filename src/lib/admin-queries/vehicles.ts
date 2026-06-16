import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type {
  AdminVehicle,
  AdminVehicleDetail,
  AdminBrand,
  AdminOptionRule,
  VehicleQuoteStats,
} from "@/types/admin";
import { fillDailyGaps } from "./shared";
import { getCalcConditionDistribution } from "./quote-calc-stats";
import { makeBrandComparator } from "@/lib/brand-sort";
import { getBrandSignals } from "@/lib/brand-signals";

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
    evSubsidy: v.evSubsidy,
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
          options: {
            orderBy: [{ displayOrder: "asc" }, { price: "asc" }],
            include: { badge: { select: { id: true, label: true } } },
          },
          rules: true,
        },
      },
      colors: {
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
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
    evSubsidy: v.evSubsidy,
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
      isVisible: l.isVisible,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
    trims: v.trims.map((t) => ({
      id: t.id,
      vehicleId: t.vehicleId,
      lineupId: t.lineupId,
      name: t.name,
      price: t.price,
      discountPrice: t.discountPrice,
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
        displayOrder: o.displayOrder,
        badgeId: o.badgeId,
        badge: o.badge ? { id: o.badge.id, label: o.badge.label } : null,
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
    colors: v.colors.map((c) => ({
      id: c.id,
      vehicleId: c.vehicleId,
      kind: c.kind,
      name: c.name,
      hexCode: c.hexCode,
      imageUrl: c.imageUrl,
      priceDelta: c.priceDelta,
      isDefault: c.isDefault,
      sortOrder: c.sortOrder,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  };
}

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

  const agg = aggRows[0];
  const total = agg ? Number(agg.total) : 0;
  const memberRatio = total > 0 && agg ? (Number(agg.members) / total) * 100 : 0;
  const applyClickRate = total > 0 && agg ? (Number(agg.applies) / total) * 100 : 0;
  const avgMonthly = agg?.avgMonthly ? Math.round(agg.avgMonthly) : 0;

  // 일별 추이 — since가 있을 때만 의미 있음
  const dailyTrend = since
    ? fillDailyGaps(
        dailyRows,
        since,
        Math.ceil((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000))
      )
    : [];

  // 트림명 조인
  const trimIds = trimGroups
    .map((g) => g.trimId)
    .filter((id): id is string => Boolean(id));
  const trims = trimIds.length
    ? await prisma.trim.findMany({
        where: { id: { in: trimIds } },
        select: { id: true, name: true },
      })
    : [];
  const trimNameMap = new Map(trims.map((t) => [t.id, t.name]));
  const topTrims = trimGroups.map((g) => ({
    label: trimNameMap.get(g.trimId!) ?? "기타",
    value: g._count._all,
  }));

  // 옵션명 조인
  const optionIds = optionRows.map((r) => r.optionId);
  const options = optionIds.length
    ? await prisma.trimOption.findMany({
        where: { id: { in: optionIds } },
        select: { id: true, name: true },
      })
    : [];
  const optionNameMap = new Map(options.map((o) => [o.id, o.name]));
  const topOptions = optionRows.map((r) => ({
    label: optionNameMap.get(r.optionId) ?? "(삭제됨)",
    value: Number(r.count),
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

export async function getAdminBrands(): Promise<AdminBrand[]> {
  const [brands, counts] = await Promise.all([
    prisma.brand.findMany(),
    prisma.vehicle.groupBy({
      by: ["brand"],
      _count: { id: true },
    }),
  ]);

  const countMap = new Map(counts.map((g) => [g.brand, g._count.id]));

  const enriched: AdminBrand[] = brands.map((b) => ({
    id: b.id,
    name: b.name,
    logoUrl: b.logoUrl,
    displayOrder: b.displayOrder,
    isFeatured: b.isFeatured,
    vehicleCount: countMap.get(b.name) ?? 0,
  }));

  // 정렬 SSOT: makeBrandComparator(signals).
  // 자체 enriched 결과로 신호 맵을 구성해 외부 fetch 없이 정렬 가능.
  const signals = new Map(
    enriched.map((b) => [
      b.name,
      {
        isFeatured: b.isFeatured,
        displayOrder: b.displayOrder,
        vehicleCount: b.vehicleCount,
      },
    ])
  );
  const cmp = makeBrandComparator(signals);
  return enriched.sort((a, b) => cmp(a.name, b.name));
}

// 외부 호출처가 직접 signals 가 필요한 경우에 사용
export { getBrandSignals };
