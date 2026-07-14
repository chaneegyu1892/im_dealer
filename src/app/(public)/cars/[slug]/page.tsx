// ISR: 10분마다 재생성. 첫 요청 시 on-demand prerender 후 캐시.
// 어드민 mutation 시 revalidatePath('/cars/[slug]', 'page') 로 즉시 무효화.
//
// 주의: generateStaticParams 로 빌드 시점에 일괄 prerender 하지 않는다.
// Supabase pgbouncer 풀(connection_limit=1) 환경에서 다중 worker가 동시 조회 시
// connection pool timeout 으로 빌드가 실패한다.
export const revalidate = 600;

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PUBLIC_TRIM_WHERE } from "@/lib/vehicle-visibility-policy";

import { getRepresentativeQuotesByVehicle } from "@/lib/representative-quote-query";
import type { RepresentativeQuote } from "@/lib/representative-quote";
import { subsidyRangeFromTrims } from "@/lib/ev-subsidy";
import { buildCarJsonLd } from "@/lib/car-json-ld";
import type { VehicleDetail, VehicleDetailedSpecs } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { CarDetailClient } from "./CarDetailClient";
import { CarNotFoundView } from "@/components/cars/CarNotFoundView";
import {
  getPublicReviewsByVehicleId,
  getBestReviews,
} from "@/lib/admin-queries";
import { CustomerReviewsSection } from "@/components/home/CustomerReviewsSection";
import { BestReviewSection } from "@/components/reviews/BestReviewSection";
import {
  canUseLegacyImageFallback,
  publicThumbnailProjectionSelect,
  publicVehicleImageStateInclude,
  resolvePublicThumbnailUrl,
  resolvePublicVehicleImages,
} from "@/lib/vehicle-images/public";

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
      ...publicThumbnailProjectionSelect,
      description: true,
      isVisible: true,
      trims: {
        where: PUBLIC_TRIM_WHERE,
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
    return { title: "차량을 찾을 수 없습니다", robots: { index: false, follow: false } };
  }

  const lowestPrice = v.trims[0]?.price ?? v.basePrice;
  const priceManwon = Math.round(lowestPrice / 10000).toLocaleString("ko-KR");
  const titleText = `${v.brand} ${v.name} 장기렌트·리스 견적`;
  const descText = v.description
    ? `${v.description} · 시작가 ${priceManwon}만원. AI 기반 진짜견적.`
    : `${v.brand} ${v.name} 장기렌트·리스 견적을 시작가 ${priceManwon}만원부터 비교하세요. AI 기반 진짜견적.`;
  const url = `${SITE_URL}/cars/${v.slug}`;
  const thumbnailUrl = resolvePublicThumbnailUrl(v);

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
      images: thumbnailUrl
        ? [{ url: thumbnailUrl, alt: `${v.brand} ${v.name}` }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      description: descText,
      images: thumbnailUrl ? [thumbnailUrl] : undefined,
    },
  };
}

async function getVehicle(slug: string): Promise<VehicleDetail | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { slug },
    include: {
      trims: {
        where: PUBLIC_TRIM_WHERE,
        orderBy: [{ isDefault: "desc" }, { price: "asc" }],
        include: { options: true },
      },
      recConfigs: {
        where: { isActive: true },
        select: { highlights: true },
      },
      ...publicVehicleImageStateInclude,
    },
  });

  if (!vehicle || !vehicle.isVisible) return null;

  const defaultTrim = vehicle.trims.find((t) => t.isDefault) ?? vehicle.trims[0];

  // 60개월·무보증·2만km 기준 productType(장기렌트/리스)별 대표 견적가.
  // 목록 페이지와 동일하게 "모든 노출 트림" 기준 최저값으로 산출 — 트림 선택 차이로
  // 목록과 상세 견적가가 달라지거나 "견적 준비중"이 뜨던 문제 방지.
  const quotesByVehicle = await getRepresentativeQuotesByVehicle([
    {
      vehicleId: vehicle.id,
      vehicleSurchargeRate: vehicle.surchargeRate,
      trims: vehicle.trims.map((t) => ({
        trimId: t.id,
        vehiclePrice: t.price,
        discountPrice: t.discountPrice,
      })),
    },
  ]);
  const representativeQuotes: RepresentativeQuote[] =
    quotesByVehicle.get(vehicle.id) ?? [];
  const bestFinanceName: string | null =
    representativeQuotes[0]?.financeCompanyName ?? null;

  const recConfig = vehicle.recConfigs ?? null;
  const legacyImageFallbackAllowed = canUseLegacyImageFallback(vehicle);
  const thumbnailUrl = resolvePublicThumbnailUrl(vehicle);
  const heroImageProjectionAllowed = thumbnailUrl !== "";

  return {
    id: vehicle.id,
    slug: vehicle.slug,
    name: vehicle.name,
    brand: vehicle.brand,
    category: vehicle.category as VehicleDetail["category"],
    vehicleCode: vehicle.vehicleCode,
    basePrice: vehicle.basePrice,
    evSubsidyRange: subsidyRangeFromTrims(vehicle.trims),
    thumbnailUrl,
    imageUrls: legacyImageFallbackAllowed ? vehicle.imageUrls : [],
    images: resolvePublicVehicleImages(vehicle.images),
    legacyImageFallbackAllowed,
    heroImageProjectionAllowed,
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
    scenarios: null,
    bestFinanceName,
    representativeQuotes,
    highlights: recConfig?.highlights ?? [],
    hasRateConfig: representativeQuotes.length > 0,
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
  if (!vehicle) return <CarNotFoundView />;

  const [reviews, bestReviews] = await Promise.all([
    getPublicReviewsByVehicleId(vehicle.id, 10),
    getBestReviews({ vehicleId: vehicle.id, limit: 4 }),
  ]);

  const jsonLd = buildCarJsonLd({
    siteUrl: SITE_URL,
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
