export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import type { RateMatrix } from "@/types/quote";
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

  // 최저가 견적 산출
  const vehicleCodes = vehicles
    .map((v) => v.vehicleCode)
    .filter(Boolean) as string[];

  const rateConfigs = await prisma.rateConfig.findMany({
    where: {
      vehicleCode: { in: vehicleCodes },
      productType: "렌트",
      isActive: true,
      financeCompany: { isActive: true },
    },
  });

  const lowestRateByCode = new Map<string, number>();
  for (const rc of rateConfigs) {
    const rates = rc.minPriceRates as Record<string, Record<string, number>>;
    const rate48 = rates["20000"]?.["48"] ?? 0;
    if (rate48 <= 0) continue;
    const existing = lowestRateByCode.get(rc.vehicleCode) ?? Infinity;
    if (rate48 < existing) {
      lowestRateByCode.set(rc.vehicleCode, rate48);
    }
  }

  return vehicles.map((v) => {
    const defaultTrim = v.trims[0];
    const rate = v.vehicleCode ? lowestRateByCode.get(v.vehicleCode) : undefined;
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
    };
  });
}

export default async function CarsPage() {
  const vehicles = await getVehicles();
  return <CarsClientPage vehicles={vehicles} />;
}
