import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "차량 탐색",
  description: "장기렌트·리스 가능한 전체 차량을 한눈에 비교하세요. 브랜드, 카테고리별 필터로 원하는 차량을 쉽게 찾을 수 있습니다.",
  openGraph: {
    title: "차량 탐색 | 아임딜러",
    description: "장기렌트·리스 가능한 전체 차량을 한눈에 비교하세요.",
  },
};

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { CarsClientPage } from "./CarsClientPage";

async function getVehicles(): Promise<VehicleListItem[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    orderBy: { displayOrder: "asc" },
    include: {
      trims: {
        where: { isVisible: true },
        orderBy: { isDefault: "desc" },
        take: 1,
      },
      recConfigs: {
        where: { isActive: true },
        select: { highlights: true },
      },
    },
  });

  // 최저가 견적 산출 — defaultTrim 기준 capitalRateSheet
  const defaultTrimIds = vehicles.map((v) => v.trims[0]?.id).filter(Boolean) as string[];
  const rateSheets = defaultTrimIds.length > 0
    ? await prisma.capitalRateSheet.findMany({
        where: { trimId: { in: defaultTrimIds }, isActive: true },
        select: { trimId: true, minRateMatrix: true },
      })
    : [];

  const lowestRateByTrimId = new Map<string, number>();
  for (const rs of rateSheets) {
    const rate48 = (rs.minRateMatrix as Record<string, number>)?.["48_20000"] ?? 0;
    if (rate48 <= 0) continue;
    const existing = lowestRateByTrimId.get(rs.trimId) ?? Infinity;
    if (rate48 < existing) lowestRateByTrimId.set(rs.trimId, rate48);
  }

  return vehicles.map((v) => {
    const defaultTrim = v.trims[0];
    const rate = defaultTrim ? lowestRateByTrimId.get(defaultTrim.id) : undefined;
    const trimPrice = defaultTrim?.price ?? v.basePrice;
    const monthlyFrom = rate ? Math.round(trimPrice * rate) : 0;

    return {
      id: v.id,
      slug: v.slug,
      name: v.name,
      brand: v.brand,
      category: v.category as VehicleListItem["category"],
      basePrice: v.basePrice,
      thumbnailUrl: v.thumbnailUrl,
      isPopular: v.isPopular,
      description: v.description,
      displayOrder: v.displayOrder,
      defaultTrim: defaultTrim
        ? {
            name: defaultTrim.name,
            price: defaultTrim.price,
            engineType: defaultTrim.engineType as EngineType,
            fuelEfficiency: defaultTrim.fuelEfficiency,
            specs: defaultTrim.specs as Record<string, string> | null,
          }
        : null,
      monthlyFrom,
      highlights: v.recConfigs?.highlights ?? [],
      tags: v.tags,
    };
  });
}

export default async function CarsPage() {
  const vehicles = await getVehicles();
  return <CarsClientPage vehicles={vehicles} />;
}
