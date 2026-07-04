import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "견적 계산기",
  description: "장기렌트·리스 실시간 견적 계산기. 차량·트림·옵션을 선택하고 초기 비용 유무에 따른 2가지 시나리오로 비교하세요.",
  openGraph: {
    title: "견적 계산기 | 아임딜러",
    description: "장기렌트·리스 실시간 견적 계산기. 2가지 시나리오로 비교하세요.",
  },
};

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import type { VehicleListItem } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import { subsidyRangeFromTrims } from "@/lib/ev-subsidy";
import { QuoteClientPage } from "./QuoteClientPage";
import { QuoteClientPageV2 } from "./QuoteClientPageV2";

async function getVehicles(): Promise<VehicleListItem[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    orderBy: [{ isPopular: "desc" }, { displayOrder: "asc" }],
    include: {
      trims: {
        where: { isVisible: true },
        orderBy: { isDefault: "desc" },
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
    evSubsidyRange: subsidyRangeFromTrims(v.trims),
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
    highlights: v.recConfigs?.highlights ?? [],
    tags: v.tags,
  }));
}

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [vehicles, params] = await Promise.all([getVehicles(), searchParams]);
  // 임시 분기: ?v2=1 이면 v2 재작업 컴포넌트 렌더. 기본은 기존 v1 유지.
  const useV2 = params?.v2 === "1";
  return (
    <Suspense>
      {useV2 ? (
        <QuoteClientPageV2 vehicles={vehicles} />
      ) : (
        <QuoteClientPage vehicles={vehicles} />
      )}
    </Suspense>
  );
}
