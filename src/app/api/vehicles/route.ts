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

    // 최저가 견적 산출 — 각 차량 defaultTrim의 활성 capitalRateSheet 조회
    const defaultTrimIds = vehicles
      .map((v) => v.trims[0]?.id)
      .filter(Boolean) as string[];

    const rateSheets = defaultTrimIds.length > 0
      ? await (prisma as any).capitalRateSheet.findMany({
          where: { trimId: { in: defaultTrimIds }, isActive: true },
          select: { trimId: true, minRateMatrix: true, financeCompany: { select: { surchargeRate: true } } },
        })
      : [];

    // 순위 가산율 조회 (1순위 값만 사용)
    const rankSurcharges = await prisma.rankSurchargeConfig.findMany({ orderBy: { rank: "asc" } });
    const rank1Rate = rankSurcharges.length > 0 ? rankSurcharges[0].rate : 1.0; // 기본 1%

    // trimId → 최저 월납입 맵 (48개월, 2만km 기준, 가산율 반영)
    const lowestMonthlyByTrimId = new Map<string, number>();
    // vehicleId → trimId 매핑 (차량 가산율 적용용)
    const trimToVehicle = new Map<string, typeof vehicles[0]>();
    for (const v of vehicles) {
      const defaultTrim = v.trims[0];
      if (defaultTrim) trimToVehicle.set(defaultTrim.id, v);
    }

    for (const rs of rateSheets) {
      const rate48 = (rs.minRateMatrix as Record<string, number>)?.["48_20000"] ?? 0;
      if (rate48 <= 0) continue;

      const vehicle = trimToVehicle.get(rs.trimId);
      const vehicleSurchargeRate = vehicle?.surchargeRate ?? 0;
      const financeSurchargeRate = rs.financeCompany?.surchargeRate ?? 0;
      const trimPrice = vehicle?.trims[0]?.price ?? vehicle?.basePrice ?? 0;

      // 전체 파이프라인: 기준대여료 × (1+순위가산) × (1+차량가산) × (1+금융사가산)
      const base = trimPrice * rate48;
      const withRank = base * (1 + rank1Rate / 100);
      const withVehicle = withRank * (1 + vehicleSurchargeRate / 100);
      const monthly = Math.round(withVehicle * (1 + financeSurchargeRate / 100));

      const existing = lowestMonthlyByTrimId.get(rs.trimId) ?? Infinity;
      if (monthly < existing) {
        lowestMonthlyByTrimId.set(rs.trimId, monthly);
      }
    }

    const data = vehicles.map((v) => {
      const defaultTrim = v.trims[0];
      const monthlyFrom = defaultTrim ? (lowestMonthlyByTrimId.get(defaultTrim.id) ?? 0) : 0;
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
