export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { getBrandSignals } from "@/lib/brand-signals";
import type { BrandSignal } from "@/lib/brand-sort";
import { getRepresentativeQuotesByVehicle } from "@/lib/representative-quote-query";
import { lowestMonthly } from "@/lib/representative-quote";
import { subsidyRangeFromTrims } from "@/lib/ev-subsidy";
import { deriveHashtags } from "@/lib/vehicle-hashtags";
import { CarsClientPage } from "./CarsClientPage";
import {
  publicThumbnailProjectionSelect,
  resolvePublicThumbnailUrl,
} from "@/lib/vehicle-images/public";
import { PUBLIC_TRIM_WHERE } from "@/lib/vehicle-visibility-policy";

type CarsPageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseInitialSearchQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const value = searchParams.query;
  const rawValue = Array.isArray(value) ? value[0] : value;
  return (rawValue ?? "").trim().slice(0, 80);
}

async function getVehicles(): Promise<VehicleListItem[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      brand: true,
      category: true,
      basePrice: true,
      ...publicThumbnailProjectionSelect,
      isPopular: true,
      isSpotlight: true,
      description: true,
      displayOrder: true,
      tags: true,
      surchargeRate: true,
      trims: {
        where: PUBLIC_TRIM_WHERE,
        orderBy: { isDefault: "desc" },
        select: {
          id: true,
          name: true,
          price: true,
          discountPrice: true,
          evSubsidy: true,
          engineType: true,
          fuelEfficiency: true,
          specs: true,
        },
      },
      recConfigs: {
        where: { isActive: true },
        select: { highlights: true },
      },
    },
  });

  const availableInventory = await prisma.inventory.findMany({
    where: {
      status: "AVAILABLE",
      stockCount: { gt: 0 },
      trim: {
        isVisible: true,
        vehicleId: { in: vehicles.map((vehicle) => vehicle.id) },
      },
    },
    select: {
      trim: {
        select: { vehicleId: true },
      },
    },
  });
  const availableVehicleIds = new Set(
    availableInventory.map((inventory) => inventory.trim.vehicleId),
  );

  const spotlightVehicles = vehicles.filter((vehicle) => vehicle.isSpotlight);
  // 첫 렌더에서는 주목 차량만 대표 견적가를 계산한다.
  // 필터 선택 후 목록 카드 가격은 /api/vehicles/representative-quotes에서 필요한 ID만 지연 로드한다.
  const quotesByVehicle = await getRepresentativeQuotesByVehicle(
    spotlightVehicles.map((v) => ({
      vehicleId: v.id,
      vehicleSurchargeRate: v.surchargeRate,
      trims: v.trims.map((t) => ({
        trimId: t.id,
        vehiclePrice: t.price,
        discountPrice: t.discountPrice,
      })),
    }))
  );

  return vehicles.map((v) => {
    const defaultTrim = v.trims[0];
    const representativeQuotes = quotesByVehicle.get(v.id) ?? [];
    const monthlyFrom = lowestMonthly(representativeQuotes);
    const hasAvailableInventory = availableVehicleIds.has(v.id);

    return {
      id: v.id,
      slug: v.slug,
      name: v.name,
      brand: v.brand,
      category: v.category as VehicleListItem["category"],
      basePrice: v.basePrice,
      evSubsidyRange: subsidyRangeFromTrims(v.trims),
      thumbnailUrl: resolvePublicThumbnailUrl(v),
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
      hashtags: deriveHashtags({
        category: v.category as "SUV" | "세단" | "밴" | "트럭",
        isPopular: v.isPopular,
        vehicleName: v.name,
        basePrice: v.basePrice,
        defaultTrim: defaultTrim
          ? {
              name: defaultTrim.name,
              engineType: defaultTrim.engineType as EngineType,
              fuelEfficiency: defaultTrim.fuelEfficiency,
            }
          : null,
        manualTags: v.tags,
      }),
      tags: v.tags,
      hasAvailableInventory,
    };
  });
}

export default async function CarsPage({ searchParams }: CarsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialSearchQuery = parseInitialSearchQuery(resolvedSearchParams);
  const [vehicles, signalsMap] = await Promise.all([getVehicles(), getBrandSignals()]);
  // Map은 직렬화 안 되므로 plain object로 변환해 클라이언트 컴포넌트에 전달
  const brandSignals: Record<string, BrandSignal> = Object.fromEntries(signalsMap);
  return (
    <CarsClientPage
      key={initialSearchQuery}
      vehicles={vehicles}
      brandSignals={brandSignals}
      initialSearchQuery={initialSearchQuery}
    />
  );
}
