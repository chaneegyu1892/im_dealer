export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { calculateMultiFinanceQuote, type RateConfigData, type CalcInput } from "@/lib/quote-calculator";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";
import type { VehicleDetail, VehicleDetailedSpecs } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import type { RecommendScenarios } from "@/types/recommendation";
import { notFound } from "next/navigation";
import { CarDetailClient } from "./CarDetailClient";

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

  return <CarDetailClient vehicle={vehicle} />;
}
