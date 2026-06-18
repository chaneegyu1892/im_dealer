// ISR: 10분마다 정적 재생성. 차량/요율표/후기 변경 시 revalidatePath('/', 'page') 로 즉시 무효화.
export const revalidate = 600;

import { prisma } from "@/lib/prisma";
import { getHomeTopLikedReviews } from "@/lib/admin-queries";
import { HeroSection } from "@/components/home/HeroSection";
import { CustomerReviewsSection } from "@/components/home/CustomerReviewsSection";
import { PopularCarsSection } from "@/components/home/PopularCarsSection";
import { ServiceIntroSection } from "@/components/home/ServiceIntroSection";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { getRepresentativeQuotesByVehicle } from "@/lib/representative-quote-query";
import { lowestMonthly } from "@/lib/representative-quote";
import { subsidyRangeFromTrims } from "@/lib/ev-subsidy";

async function getPopularVehicles(): Promise<VehicleListItem[]> {
  const baseVehicleQuery = {
    orderBy: { displayOrder: "asc" },
    take: 6,
    include: {
      trims: {
        where: { isVisible: true },
        orderBy: { isDefault: "desc" },
        include: {
          inventory: {
            where: { status: "AVAILABLE", stockCount: { gt: 0 } },
            select: { id: true },
          },
        },
      },
      recConfigs: {
        where: { isActive: true },
        select: { highlights: true },
      },
    },
  } as const;

  const popularVehicles = await prisma.vehicle.findMany({
    where: { isVisible: true, isPopular: true },
    ...baseVehicleQuery,
  });

  const vehicles = popularVehicles.length > 0
    ? popularVehicles
    : await prisma.vehicle.findMany({
        where: { isVisible: true },
        ...baseVehicleQuery,
      });

  const vehicleCodes = vehicles.map((v) => v.vehicleCode).filter(Boolean) as string[]; void vehicleCodes; // 미사용 (하위 참조 제거)

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
      hasAvailableInventory: v.trims.some((trim) => trim.inventory.length > 0),
    };
  });
}

export default async function HomePage() {
  const [popularVehicles, reviews] = await Promise.all([
    getPopularVehicles(),
    getHomeTopLikedReviews(10),
  ]);

  return (
    <div>
      <HeroSection />
      {reviews.length > 0 && (
        <CustomerReviewsSection
          reviews={reviews}
          sectionLabel="BEST 리뷰"
          title="가장 많은 공감을 받은 후기"
          showImages
          forceBestBadge
        />
      )}
      {popularVehicles.length > 0 && (
        <PopularCarsSection vehicles={popularVehicles} />
      )}
      <ServiceIntroSection />
    </div>
  );
}
