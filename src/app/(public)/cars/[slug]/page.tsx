// ISR: 10분마다 재생성. 첫 요청 시 on-demand prerender 후 캐시.
// 어드민 mutation 시 revalidatePath('/cars/[slug]', 'page') 로 즉시 무효화.
//
// 주의: generateStaticParams 로 빌드 시점에 일괄 prerender 하지 않는다.
// Supabase pgbouncer 풀(connection_limit=1) 환경에서 다중 worker가 동시 조회 시
// connection pool timeout 으로 빌드가 실패한다.
export const revalidate = 600;

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

import { calculateMultiFinanceQuote, type RateConfigData, type CalcInput } from "@/lib/quote-calculator";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import type { VehicleDetail, VehicleDetailedSpecs } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import type { RecommendScenarios } from "@/types/recommendation";
import { notFound } from "next/navigation";
import { CarDetailClient } from "./CarDetailClient";
import {
  getPublicReviewsByVehicleId,
  getBestReviews,
} from "@/lib/admin-queries";
import { CustomerReviewsSection } from "@/components/home/CustomerReviewsSection";
import { BestReviewSection } from "@/components/reviews/BestReviewSection";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// 메타데이터·JSON-LD 용 가벼운 차량 조회. 본문 렌더링용 getVehicle 과 분리해
// SEO 헤더 생성 시 무거운 join(트림·옵션·요율표 전체) 을 피한다.
async function getVehicleMeta(slug: string) {
  return prisma.vehicle.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      brand: true,
      category: true,
      basePrice: true,
      thumbnailUrl: true,
      description: true,
      isVisible: true,
      trims: {
        where: { isVisible: true },
        select: { price: true },
        orderBy: { price: "asc" },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const v = await getVehicleMeta(slug);
  if (!v || !v.isVisible) {
    return { title: "차량을 찾을 수 없습니다" };
  }

  const lowestPrice = v.trims[0]?.price ?? v.basePrice;
  const priceManwon = Math.round(lowestPrice / 10000).toLocaleString("ko-KR");
  const titleText = `${v.brand} ${v.name} 장기렌트·리스 견적`;
  const descText = v.description
    ? `${v.description} · 시작가 ${priceManwon}만원. AI 기반 진짜견적.`
    : `${v.brand} ${v.name} 장기렌트·리스 견적을 시작가 ${priceManwon}만원부터 비교하세요. AI 기반 진짜견적.`;
  const url = `${SITE_URL}/cars/${v.slug}`;

  return {
    title: titleText,
    description: descText,
    alternates: { canonical: url },
    openGraph: {
      title: titleText,
      description: descText,
      url,
      type: "website",
      locale: "ko_KR",
      siteName: "아임딜러",
      images: v.thumbnailUrl
        ? [{ url: v.thumbnailUrl, alt: `${v.brand} ${v.name}` }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      description: descText,
      images: v.thumbnailUrl ? [v.thumbnailUrl] : undefined,
    },
  };
}

interface CarJsonLdInput {
  slug: string;
  name: string;
  brand: string;
  category: string;
  description: string | null;
  thumbnailUrl: string | null;
  trims: { price: number }[];
  basePrice: number;
}

function buildCarJsonLd(v: CarJsonLdInput): Record<string, unknown>[] {
  const url = `${SITE_URL}/cars/${v.slug}`;
  const prices = v.trims.length > 0 ? v.trims.map((t) => t.price) : [v.basePrice];
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);
  const offerCount = prices.length;

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${v.brand} ${v.name}`,
    description: v.description ?? `${v.brand} ${v.name} 장기렌트·리스 견적`,
    brand: { "@type": "Brand", name: v.brand },
    category: v.category,
    url,
    ...(v.thumbnailUrl ? { image: v.thumbnailUrl } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "KRW",
      lowPrice,
      highPrice,
      offerCount,
      url,
      availability: "https://schema.org/InStock",
    },
  };

  const breadcrumb: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "차량", item: `${SITE_URL}/cars` },
      { "@type": "ListItem", position: 3, name: v.brand },
      { "@type": "ListItem", position: 4, name: v.name, item: url },
    ],
  };

  return [product, breadcrumb];
}

async function getVehicle(slug: string): Promise<VehicleDetail | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { slug },
    include: {
      trims: {
        where: { isVisible: true },
        orderBy: [{ isDefault: "desc" }, { price: "asc" }],
        include: { options: true },
      },
      recConfigs: {
        where: { isActive: true },
        select: { highlights: true, aiCaption: true },
      },
    },
  });

  if (!vehicle || !vehicle.isVisible) return null;

  const defaultTrim = vehicle.trims.find((t) => t.isDefault) ?? vehicle.trims[0];

  let scenarios: RecommendScenarios | null = null;
  let bestFinanceName: string | null = null;
  let rateSheets: any[] = [];

  if (defaultTrim) {
    rateSheets = await (prisma as any).capitalRateSheet.findMany({
      where: { trimId: defaultTrim.id, isActive: true, financeCompany: { isActive: true } },
      include: { financeCompany: true },
    });
  }

  if (defaultTrim && rateSheets.length > 0) {
    const configs: RateConfigData[] = rateSheets.map((rs: any) => ({
      financeCompanyId: rs.financeCompanyId,
      financeCompanyName: rs.financeCompany.name,
      financeSurchargeRate: rs.financeCompany.surchargeRate,
      minVehiclePrice: rs.minVehiclePrice,
      maxVehiclePrice: rs.maxVehiclePrice,
      minRateMatrix: rs.minRateMatrix,
      maxRateMatrix: rs.maxRateMatrix,
      depositDiscountRate: rs.depositDiscountRate,
      prepayAdjustRate: rs.prepayAdjustRate,
    }));

    // 순위 가산율: DB 조회 → fallback 상수
    const rankSurcharges = await prisma.rankSurchargeConfig.findMany({
      orderBy: { rank: "asc" },
    });
    const rankRates = rankSurcharges.length > 0
      ? rankSurcharges.map((r) => r.rate)
      : [...RANK_SURCHARGE_RATES];

    // 시나리오별 전체 파이프라인 (순위가산 + 차량가산 + 금융사가산 포함)
    const scenarioConditions = [
      { key: "conservative", depositRate: 20, prepayRate: 0 },
      { key: "standard",     depositRate: 0,  prepayRate: 0 },
      { key: "aggressive",   depositRate: 0,  prepayRate: 30 },
    ] as const;

    const builtScenarios: Record<string, {
      monthlyPayment: number;
      depositAmount: number;
      prepayAmount: number;
      contractMonths: number;
      annualMileage: number;
      contractType: string;
    }> = {};

    for (const sc of scenarioConditions) {
      const calcInput: CalcInput = {
        vehiclePrice: defaultTrim.price,
        contractMonths: 48,
        annualMileage: 20000,
        depositRate: sc.depositRate,
        prepayRate: sc.prepayRate,
        vehicleSurchargeRate: vehicle.surchargeRate,
        rankSurchargeRates: rankRates,
        rateConfigs: configs,
      };

      const results = calculateMultiFinanceQuote(calcInput);
      const best = results[0];

      if (best) {
        if (sc.key === "conservative" || !bestFinanceName) {
          bestFinanceName = best.financeCompanyName;
        }
        builtScenarios[sc.key] = {
          monthlyPayment: best.monthlyPayment,
          depositAmount: best.breakdown.depositAmount,
          prepayAmount: best.breakdown.prepayAmount,
          contractMonths: 48,
          annualMileage: 20000,
          contractType: "반납형",
        };
      }
    }

    if (Object.keys(builtScenarios).length === 3) {
      scenarios = builtScenarios as unknown as RecommendScenarios;
    }
  }

  const recConfig = vehicle.recConfigs ?? null;

  return {
    id: vehicle.id,
    slug: vehicle.slug,
    name: vehicle.name,
    brand: vehicle.brand,
    category: vehicle.category as VehicleDetail["category"],
    vehicleCode: vehicle.vehicleCode,
    basePrice: vehicle.basePrice,
    evSubsidy: vehicle.evSubsidy,
    thumbnailUrl: vehicle.thumbnailUrl,
    imageUrls: vehicle.imageUrls,
    surchargeRate: vehicle.surchargeRate,
    isPopular: vehicle.isPopular,
    description: vehicle.description,
    trims: vehicle.trims.map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      engineType: t.engineType as EngineType,
      fuelEfficiency: t.fuelEfficiency,
      isDefault: t.isDefault,
      specs: t.specs as Record<string, string> | null,
      options: t.options.map((o) => ({
        id: o.id,
        name: o.name,
        price: o.price,
        category: o.category,
        isDefault: o.isDefault,
      })),
    })),
    defaultTrim: defaultTrim
      ? {
          id: defaultTrim.id,
          name: defaultTrim.name,
          price: defaultTrim.price,
          engineType: defaultTrim.engineType as EngineType,
          fuelEfficiency: defaultTrim.fuelEfficiency,
          specs: defaultTrim.specs as Record<string, string> | null,
        }
      : null,
    scenarios,
    bestFinanceName,
    highlights: recConfig?.highlights ?? [],
    aiCaption: recConfig?.aiCaption ?? null,
    hasRateConfig: rateSheets.length > 0,
    detailedSpecs: (vehicle.detailedSpecs as VehicleDetailedSpecs | null) ?? null,
  };
}

export default async function CarDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicle(slug);
  if (!vehicle) notFound();

  const [reviews, bestReviews] = await Promise.all([
    getPublicReviewsByVehicleId(vehicle.id, 10),
    getBestReviews({ vehicleId: vehicle.id, limit: 4 }),
  ]);

  const jsonLd = buildCarJsonLd({
    slug: vehicle.slug,
    name: vehicle.name,
    brand: vehicle.brand,
    category: vehicle.category,
    description: vehicle.description,
    thumbnailUrl: vehicle.thumbnailUrl,
    trims: vehicle.trims.map((t) => ({ price: t.price })),
    basePrice: vehicle.basePrice,
  });

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          // 컨트롤된 객체를 JSON.stringify 로 직렬화하므로 XSS 위험 없음.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <CarDetailClient vehicle={vehicle} />
      {bestReviews.length > 0 && (
        <section className="page-container py-12">
          <BestReviewSection
            reviews={bestReviews}
            title={`${vehicle.brand} ${vehicle.name} 베스트 후기`}
            description="이 차량의 추천 후기"
          />
        </section>
      )}
      {reviews.length > 0 && (
        <CustomerReviewsSection
          reviews={reviews}
          sectionLabel="이 차량 후기"
          title={`${vehicle.brand} ${vehicle.name} 이용자들의 이야기`}
          showImages
        />
      )}
    </>
  );
}
