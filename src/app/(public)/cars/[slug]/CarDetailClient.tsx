"use client";

import {
  Building2,
  Leaf,
  MapPin,
  Receipt,
  TrendingDown,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { CarDetailBenefitsSection } from "@/components/cars/CarDetailBenefitsSection";
import { CarDetailHero } from "@/components/cars/CarDetailHero";
import { CarDetailImageSections } from "@/components/cars/CarDetailImageSections";
import { CarDetailRecommendBanner } from "@/components/cars/CarDetailRecommendBanner";
import {
  CarDetailRecommendationSection,
  type DetailTag,
} from "@/components/cars/CarDetailRecommendationSection";
import { CarDetailSidebar, MobileQuoteSummary } from "@/components/cars/CarDetailQuoteSurfaces";
import { CarDetailSpecsSection } from "@/components/cars/CarDetailSpecsSection";
import { CarImageGallery } from "@/components/cars/CarImageGallery";
import type { VehicleDetail, VehicleImageKind } from "@/types/api";
import type { EngineType } from "@/types/vehicle";

const KEYWORD_TAGS: { keywords: string[]; icon: ReactNode; label: string }[] = [
  { keywords: ["법인", "비용처리", "경비"], icon: <Building2 size={13} />, label: "법인·사업자" },
  { keywords: ["친환경", "전기", "EV", "ev"], icon: <Leaf size={13} />, label: "친환경 선호" },
  { keywords: ["연비", "유지비", "절감"], icon: <TrendingDown size={13} />, label: "유지비 절감" },
  { keywords: ["출퇴근", "통근", "업무"], icon: <MapPin size={13} />, label: "출퇴근·업무용" },
  { keywords: ["가족", "넓", "공간"], icon: <Users size={13} />, label: "가족 동반" },
  { keywords: ["절세", "세제", "혜택"], icon: <Receipt size={13} />, label: "절세 혜택" },
];

const PRIMARY_IMAGE_TYPES: readonly VehicleImageKind[] = ["MAIN", "COVER"];

function deriveTags(vehicle: VehicleDetail, engineType: EngineType): DetailTag[] {
  const joined = vehicle.highlights.join(" ");
  const tags = KEYWORD_TAGS.filter(({ keywords }) =>
    keywords.some((keyword) => joined.includes(keyword)),
  ).map(({ icon, label }) => ({ icon, label }));

  if (tags.length < 3) {
    if (engineType === "EV" && !tags.some((tag) => tag.label === "친환경 선호")) {
      tags.push({ icon: <Leaf size={13} />, label: "친환경 선호" });
    }
    if ((vehicle.category === "세단" || vehicle.category === "SUV") && !tags.some((tag) => tag.label === "출퇴근·업무용")) {
      tags.push({ icon: <MapPin size={13} />, label: "출퇴근·업무용" });
    }
    if (!tags.some((tag) => tag.label === "법인·사업자")) {
      tags.push({ icon: <Building2 size={13} />, label: "법인·사업자" });
    }
  }

  return tags.slice(0, 5);
}

export function CarDetailClient({ vehicle }: { vehicle: VehicleDetail }) {
  const engineType = (vehicle.defaultTrim?.engineType ?? "가솔린") as EngineType;
  const representativeQuotes = vehicle.representativeQuotes;
  // 대표 썸네일(thumbnailUrl)과 일치하는 MAIN/COVER 이미지가 있으면 그것을 갤러리 첫 슬라이드로.
  // 썸네일이 primary 그룹에 없으면 임의로 끼워넣지 않는다(마이그레이션 안 된 차량의 숨겨진
  // URL이 부활하는 것 방지). hero와 첫 슬라이드가 같은 이미지일 때 중복은 제거한다.
  const thumbnailUrl = vehicle.thumbnailUrl.trim();
  const primaryImages = vehicle.images
    .filter((image) => PRIMARY_IMAGE_TYPES.includes(image.type))
    .map((image) => image.storageUrl);
  const orderedPrimaryImages = thumbnailUrl.length > 0
    ? [
        ...primaryImages.filter((url) => url === thumbnailUrl),
        ...primaryImages.filter((url) => url !== thumbnailUrl),
      ]
    : primaryImages;
  const allImages =
    orderedPrimaryImages.length > 0
      ? orderedPrimaryImages
      : vehicle.legacyImageFallbackAllowed && vehicle.imageUrls.length > 0
      ? vehicle.imageUrls
      : vehicle.legacyImageFallbackAllowed && vehicle.thumbnailUrl
      ? [vehicle.thumbnailUrl]
      : [];
  const heroImage = vehicle.heroImageProjectionAllowed && vehicle.thumbnailUrl
    ? vehicle.thumbnailUrl
    : allImages[0] ?? "";
  const derivedTags = deriveTags(vehicle, engineType);

  return (
    <div className="public-app-page min-h-screen overflow-x-hidden pb-32 lg:pb-0">
      <CarDetailHero
        vehicle={vehicle}
        heroImage={heroImage}
        engineType={engineType}
        representativeQuotes={representativeQuotes}
      />

      <div className="page-container -mt-10 pb-5 pt-2 md:-mt-12 md:pb-10 md:pt-4">
        <MobileQuoteSummary
          vehicleName={vehicle.name}
          vehicleSlug={vehicle.slug}
          quotes={representativeQuotes}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="space-y-6 lg:col-span-2">
            <CarImageGallery vehicleName={vehicle.name} images={allImages} />
            {vehicle.detailedSpecs && <CarDetailSpecsSection specs={vehicle.detailedSpecs} category={vehicle.category} />}
            <CarDetailImageSections vehicleName={vehicle.name} images={vehicle.images} />
            <CarDetailRecommendationSection tags={derivedTags} highlights={vehicle.highlights} />
            <CarDetailBenefitsSection />
          </div>

          <CarDetailSidebar
            vehicleName={vehicle.name}
            vehicleSlug={vehicle.slug}
            quotes={representativeQuotes}
          />
        </div>

        <CarDetailRecommendBanner />
      </div>
    </div>
  );
}
