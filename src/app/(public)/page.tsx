export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { HeroSection } from "@/components/home/HeroSection";
import { PopularCarsSection } from "@/components/home/PopularCarsSection";
import { ServiceIntroSection } from "@/components/home/ServiceIntroSection";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";

async function getPopularVehicles(): Promise<VehicleListItem[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true, isPopular: true },
    orderBy: { displayOrder: "asc" },
    take: 6,
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

  const vehicleCodes = vehicles.map((v) => v.vehicleCode).filter(Boolean) as string[]; void vehicleCodes; // 미사용 (하위 참조 제거)

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

export default async function HomePage() {
  const popularVehicles = await getPopularVehicles();

  return (
    <div>
      <HeroSection />
      {popularVehicles.length > 0 && (
        <PopularCarsSection vehicles={popularVehicles} />
      )}
      <ServiceIntroSection />
    </div>
  );
}
