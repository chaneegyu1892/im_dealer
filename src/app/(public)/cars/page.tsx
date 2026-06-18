export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { getBrandSignals } from "@/lib/brand-signals";
import type { BrandSignal } from "@/lib/brand-sort";
import { getRepresentativeQuotesByVehicle } from "@/lib/representative-quote-query";
import { lowestMonthly } from "@/lib/representative-quote";
import { subsidyRangeFromTrims } from "@/lib/ev-subsidy";
import { CarsClientPage } from "./CarsClientPage";

async function getVehicles(): Promise<VehicleListItem[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    orderBy: { displayOrder: "asc" },
    include: {
      trims: {
        where: { isVisible: true },
        orderBy: { isDefault: "desc" },
        include: {
          inventory: {
            where: {
              status: "AVAILABLE",
              stockCount: { gt: 0 },
            },
            select: { id: true },
          },
        },
      },
      recConfigs: {
        where: { isActive: true },
        select: { highlights: true },
      },
    },
  });

  // 대표 견적가 산출 — 모든 노출 트림 기준 60개월·무보증·2만km productType별 최저 (목록·상세 공통)
  const quotesByVehicle = await getRepresentativeQuotesByVehicle(
    vehicles.map((v) => ({
      vehicleId: v.id,
      vehicleSurchargeRate: v.surchargeRate,
      trims: v.trims.map((t) => ({ trimId: t.id, vehiclePrice: t.price })),
    }))
  );

  return vehicles.map((v) => {
    const defaultTrim = v.trims[0];
    const representativeQuotes = quotesByVehicle.get(v.id) ?? [];
    const monthlyFrom = lowestMonthly(representativeQuotes);
    const hasAvailableInventory = v.trims.some((trim) => trim.inventory.length > 0);

    return {
      id: v.id,
      slug: v.slug,
      name: v.name,
      brand: v.brand,
      category: v.category as VehicleListItem["category"],
      basePrice: v.basePrice,
      evSubsidyRange: subsidyRangeFromTrims(v.trims),
      thumbnailUrl: v.thumbnailUrl,
      isPopular: v.isPopular,
      isSpotlight: v.isSpotlight,
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
      representativeQuotes,
      highlights: v.recConfigs?.highlights ?? [],
      tags: v.tags,
      hasAvailableInventory,
    };
  });
}

export default async function CarsPage() {
  const [vehicles, signalsMap] = await Promise.all([getVehicles(), getBrandSignals()]);
  // Map은 직렬화 안 되므로 plain object로 변환해 클라이언트 컴포넌트에 전달
  const brandSignals: Record<string, BrandSignal> = Object.fromEntries(signalsMap);
  return <CarsClientPage vehicles={vehicles} brandSignals={brandSignals} />;
}
