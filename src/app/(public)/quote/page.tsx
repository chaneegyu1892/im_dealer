export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { QuoteClientPage } from "./QuoteClientPage";

async function getVehicles(): Promise<VehicleListItem[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    orderBy: [{ isPopular: "desc" }, { displayOrder: "asc" }],
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

  return vehicles.map((v) => ({
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
    defaultTrim: v.trims[0]
      ? {
          name: v.trims[0].name,
          price: v.trims[0].price,
          engineType: v.trims[0].engineType as EngineType,
          fuelEfficiency: v.trims[0].fuelEfficiency,
          specs: v.trims[0].specs as Record<string, string> | null,
        }
      : null,
    monthlyFrom: 0,
    highlights: v.recConfigs[0]?.highlights ?? [],
  }));
}

export default async function QuotePage() {
  const vehicles = await getVehicles();
  return <QuoteClientPage vehicles={vehicles} />;
}
