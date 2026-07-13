// ISR: 10분마다 정적 재생성. 차량/요율표/후기 변경 시 revalidatePath('/', 'page') 로 즉시 무효화.
export const revalidate = 600;

import { prisma } from "@/lib/prisma";
import { getHomeTopLikedReviews } from "@/lib/admin-queries";
import { HeroSectionV2 } from "@/components/home/HeroSectionV2";
import { CustomerReviewsSection } from "@/components/home/CustomerReviewsSection";
import { PopularCarsSectionV2 } from "@/components/home/PopularCarsSectionV2";
import { ServiceIntroSection } from "@/components/home/ServiceIntroSection";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { getRepresentativeQuotesByVehicle } from "@/lib/representative-quote-query";
import { lowestMonthly } from "@/lib/representative-quote";
import { subsidyRangeFromTrims } from "@/lib/ev-subsidy";
import type { PublicReview } from "@/types/review";
import {
  publicThumbnailProjectionInclude,
  resolvePublicThumbnailUrl,
} from "@/lib/vehicle-images/public";

const DEV_REVIEW_CONTENTS = [
  "처음에는 월 납입금 차이를 잘 몰랐는데, 조건별로 비교하니까 상담 전에 기준을 잡기 쉬웠어요.",
  "차량만 먼저 고르는 방식보다 초기 비용과 월 납입금을 같이 보니 훨씬 현실적으로 결정할 수 있었습니다.",
  "여러 차종을 비교하다가 추천 흐름으로 좁혔는데, 생각보다 제 조건에 맞는 차량이 빠르게 정리됐어요.",
  "상담 전에 보증금과 선납금 차이를 이해하고 들어가서 불필요한 질문을 줄일 수 있었습니다.",
  "견적 금액이 먼저 보이니까 가족과 예산을 맞추기가 편했고, 차량 선택도 훨씬 빨라졌어요.",
  "업무용 차량을 알아보는 중이었는데 차종별 월 납입금이 정리되어 있어 비교하기 좋았습니다.",
  "복잡한 조건을 한 번에 보여주기보다 필요한 순서대로 안내해줘서 처음 이용해도 어렵지 않았어요.",
  "가격이 보이는 차량부터 비교할 수 있어서 막연하게 상담을 기다리는 느낌이 없었습니다.",
  "차량 설명보다 실제 부담 금액을 먼저 확인할 수 있어서 결정 과정이 깔끔했습니다.",
  "추천 결과를 보고 다시 차량 탐색으로 넘어가 비교했는데 흐름이 자연스럽고 이해하기 쉬웠어요.",
  "초기 비용을 낮췄을 때와 보증금을 넣었을 때 차이가 바로 보여서 조건을 정하기 좋았습니다.",
  "상담으로 바로 넘어가기 전에 스스로 비교해볼 수 있는 정보가 많아서 신뢰가 갔어요.",
] as const;

const DEV_REVIEW_NAMES = ["김*훈", "박*영", "이*민", "최*준", "정*아", "한*우", "윤*서", "조*현", "오*진", "문*호"] as const;

function buildDevelopmentReviews(
  count: number,
  vehicles: VehicleListItem[],
): PublicReview[] {
  if (count <= 0 || process.env.NODE_ENV === "production") return [];

  return Array.from({ length: count }, (_, index) => {
    const vehicle = vehicles[index % Math.max(vehicles.length, 1)];
    const contentIndex = (index * 5 + vehicles.length) % DEV_REVIEW_CONTENTS.length;

    return {
      id: `dev-home-review-${index + 1}`,
      displayName: DEV_REVIEW_NAMES[index % DEV_REVIEW_NAMES.length],
      rating: index % 4 === 0 ? 4 : 5,
      content: DEV_REVIEW_CONTENTS[contentIndex],
      vehicleId: vehicle?.id ?? null,
      vehicleName: vehicle ? `${vehicle.brand} ${vehicle.name}` : null,
      vehicleBrand: vehicle?.brand ?? null,
      reviewDate: `2026.07.${String(2 - (index % 2)).padStart(2, "0")}`,
      imageUrls: [],
      isBest: index < 4,
      likeCount: 34 - index * 2,
    };
  });
}

function buildHomeReviews(
  reviews: PublicReview[],
  vehicles: VehicleListItem[],
): PublicReview[] {
  return [
    ...reviews,
    ...buildDevelopmentReviews(Math.max(0, 10 - reviews.length), vehicles),
  ].slice(0, 10);
}

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
      ...publicThumbnailProjectionInclude,
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
      thumbnailUrl: resolvePublicThumbnailUrl(v),
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
  const homeReviews = buildHomeReviews(reviews, popularVehicles);

  return (
    <div className="bg-white text-text-body">
      <HeroSectionV2 featuredVehicle={popularVehicles[0]} />
      {popularVehicles.length > 0 && (
        <PopularCarsSectionV2 vehicles={popularVehicles} />
      )}
      {homeReviews.length > 0 && (
        <CustomerReviewsSection
          reviews={homeReviews}
          sectionLabel="BEST 리뷰"
          title="가장 많은 공감을 받은 후기"
          showImages
          forceBestBadge
        />
      )}
      <ServiceIntroSection />
    </div>
  );
}
