import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET /api/vehicles ──────────────────────────────────
// 공개 차량 목록 조회
// Query params: category, brand, sort, page, limit
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const category = searchParams.get("category") ?? undefined;
    const brand = searchParams.get("brand") ?? undefined;
    const sort = searchParams.get("sort") ?? "popular";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? "50")));
    const skip = (page - 1) * limit;

    const where = {
      isVisible: true,
      ...(category && category !== "전체" ? { category } : {}),
      ...(brand && brand !== "전체" ? { brand } : {}),
    };

    const orderBy = (() => {
      switch (sort) {
        case "price-asc":
          return { basePrice: "asc" as const };
        case "price-desc":
          return { basePrice: "desc" as const };
        default:
          return { displayOrder: "asc" as const };
      }
    })();

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          trims: {
            where: { isVisible: true },
            orderBy: { isDefault: "desc" },
            take: 1,
          },
          recConfigs: {
            where: { isActive: true },
            select: { highlights: true, aiCaption: true },
          },
        },
      }),
      prisma.vehicle.count({ where }),
    ]);

    // 최저가 견적 산출을 위해 RateConfig도 조회
    const vehicleCodes = vehicles
      .map((v) => v.vehicleCode)
      .filter(Boolean) as string[];

    const rateConfigs = await prisma.rateConfig.findMany({
      where: {
        vehicleCode: { in: vehicleCodes },
        productType: "렌트",
        isActive: true,
        financeCompany: { isActive: true },
      },
      include: { financeCompany: { select: { surchargeRate: true } } },
    });

    // vehicleCode → 최저 회수율 맵
    const lowestRateByCode = new Map<string, number>();
    for (const rc of rateConfigs) {
      const rates = rc.minPriceRates as Record<string, Record<string, number>>;
      const rate48 = rates["20000"]?.["48"] ?? 0;
      if (rate48 <= 0) continue;

      const existing = lowestRateByCode.get(rc.vehicleCode) ?? Infinity;
      if (rate48 < existing) {
        lowestRateByCode.set(rc.vehicleCode, rate48);
      }
    }

    const data = vehicles.map((v) => {
      const defaultTrim = v.trims[0];
      const rate = v.vehicleCode ? lowestRateByCode.get(v.vehicleCode) : undefined;
      const trimPrice = defaultTrim?.price ?? v.basePrice;
      const monthlyFrom = rate ? Math.round(trimPrice * rate) : 0;
      const highlights = v.recConfigs?.highlights ?? [];

      return {
        id: v.id,
        slug: v.slug,
        name: v.name,
        brand: v.brand,
        category: v.category,
        basePrice: v.basePrice,
        thumbnailUrl: v.thumbnailUrl,
        isPopular: v.isPopular,
        description: v.description,
        displayOrder: v.displayOrder,
        defaultTrim: defaultTrim
          ? {
              name: defaultTrim.name,
              price: defaultTrim.price,
              engineType: defaultTrim.engineType,
              fuelEfficiency: defaultTrim.fuelEfficiency,
              specs: defaultTrim.specs,
            }
          : null,
        monthlyFrom,
        highlights,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total, page, limit },
    });
  } catch (error) {
    console.error("[GET /api/vehicles]", error);
    return NextResponse.json(
      { error: "차량 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
