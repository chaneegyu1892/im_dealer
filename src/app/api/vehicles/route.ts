import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  publicThumbnailProjectionInclude,
  resolvePublicThumbnailUrl,
} from "@/lib/vehicle-images/public";
import { getRepresentativeQuotesByVehicle } from "@/lib/representative-quote-query";
import { lowestMonthly } from "@/lib/representative-quote";
import { PUBLIC_TRIM_WHERE } from "@/lib/vehicle-visibility-policy";

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
            where: PUBLIC_TRIM_WHERE,
            orderBy: [{ isDefault: "desc" }, { price: "asc" }],
          },
          recConfigs: {
            where: { isActive: true },
            select: { highlights: true, aiCaption: true },
          },
          ...publicThumbnailProjectionInclude,
        },
      }),
      prisma.vehicle.count({ where }),
    ]);

    const quotesByVehicle = await getRepresentativeQuotesByVehicle(
      vehicles.map((vehicle) => ({
        vehicleId: vehicle.id,
        vehicleSurchargeRate: vehicle.surchargeRate,
        trims: vehicle.trims.map((trim) => ({
          trimId: trim.id,
          vehiclePrice: trim.price,
          discountPrice: trim.discountPrice,
        })),
      })),
    );

    const data = vehicles.map((v) => {
      const defaultTrim = v.trims[0];
      const representativeQuotes = quotesByVehicle.get(v.id) ?? [];
      const monthlyFrom = lowestMonthly(representativeQuotes);
      const highlights = v.recConfigs?.highlights ?? [];

      return {
        id: v.id,
        slug: v.slug,
        name: v.name,
        brand: v.brand,
        category: v.category,
        basePrice: v.basePrice,
        thumbnailUrl: resolvePublicThumbnailUrl(v),
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
        representativeQuotes,
        highlights,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: { total, page, limit },
    });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary converts unexpected failures to 500.
    console.error("[GET /api/vehicles]", error);
    return NextResponse.json(
      { error: "차량 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
