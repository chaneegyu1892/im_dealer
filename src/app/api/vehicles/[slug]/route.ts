import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateMultiFinanceQuote,
  type RateConfigData,
  type CalcInput,
} from "@/lib/quote-calculator";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";

// ─── GET /api/vehicles/:slug ────────────────────────────
// 차량 상세 + 기본 트림 기준 시나리오 견적 (전체 파이프라인: 가산율 포함)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

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
          select: { highlights: true, aiCaption: true, scoreMatrix: true },
        },
      },
    });

    if (!vehicle || !vehicle.isVisible) {
      return NextResponse.json(
        { error: "차량을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const defaultTrim = vehicle.trims.find((t) => t.isDefault) ?? vehicle.trims[0];

    let scenarios = null;
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

      // 순위 가산율: DB → fallback 상수
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
        scenarios = builtScenarios;
      }
    }

    const recConfig = vehicle.recConfigs ?? null;

    return NextResponse.json({
      success: true,
      data: {
        id: vehicle.id,
        slug: vehicle.slug,
        name: vehicle.name,
        brand: vehicle.brand,
        category: vehicle.category,
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
          engineType: t.engineType,
          fuelEfficiency: t.fuelEfficiency,
          isDefault: t.isDefault,
          specs: t.specs,
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
              engineType: defaultTrim.engineType,
              fuelEfficiency: defaultTrim.fuelEfficiency,
              specs: defaultTrim.specs,
            }
          : null,
        scenarios,
        bestFinanceName,
        highlights: recConfig?.highlights ?? [],
        aiCaption: recConfig?.aiCaption ?? null,
        hasRateConfig: rateSheets.length > 0,
      },
    });
  } catch (error) {
    console.error("[GET /api/vehicles/:slug]", error);
    return NextResponse.json(
      { error: "차량 상세 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
