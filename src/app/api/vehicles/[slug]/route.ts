import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  calculateScenarios,
  estimateMonthly,
  type RateConfigData,
} from "@/lib/quote-calculator";

// ─── GET /api/vehicles/:slug ────────────────────────────
// 차량 상세 + 기본 트림 기준 시나리오 견적
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
    let bestFinanceName = null;
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

      let bestConfig = configs[0];
      let bestMonthly = Infinity;
      for (const cfg of configs) {
        const monthly = estimateMonthly(defaultTrim.price, cfg, 48, 20000);
        if (monthly > 0 && monthly < bestMonthly) {
          bestMonthly = monthly;
          bestConfig = cfg;
        }
      }

      scenarios = calculateScenarios(defaultTrim.price, bestConfig, 20000, 48);
      bestFinanceName = bestConfig.financeCompanyName;
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
