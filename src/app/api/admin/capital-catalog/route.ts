import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";

// GET /api/admin/capital-catalog?financeCompanyId=&productType=[&brandCd=[&modelCd=]][&q=]
// 계층 조회: 파라미터 없음 → 브랜드 요약 / brandCd → 모델 목록 / modelCd → 트림 행 전체.
// q → 트림명/모델명 검색 (수동 매핑용, 최대 30건).
export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const sp = new URL(request.url).searchParams;
    const financeCompanyId = sp.get("financeCompanyId");
    const productType = sp.get("productType") ?? "장기렌트";
    const brandCd = sp.get("brandCd");
    const modelCd = sp.get("modelCd");
    const q = sp.get("q")?.trim();
    if (!financeCompanyId) {
      return NextResponse.json({ error: "financeCompanyId가 필요합니다." }, { status: 400 });
    }
    const db = prisma;

    // 트림명/모델명 검색 (수동 매핑 콤보용)
    if (q) {
      const trims = await db.capitalCatalogTrim.findMany({
        where: {
          financeCompanyId,
          productType,
          OR: [
            { trimName: { contains: q, mode: "insensitive" } },
            { modelName: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: [{ modelName: "asc" }, { vehiclePrice: "asc" }],
        take: 30,
        select: {
          id: true, brandName: true, modelName: true, mdelCd: true, trimName: true,
          modelYear: true, vehiclePrice: true, scrapedAt: true,
        },
      });
      return NextResponse.json({ success: true, trims });
    }

    // 트림 행 전체 (브랜드+모델)
    if (brandCd && modelCd) {
      const trims = await db.capitalCatalogTrim.findMany({
        where: { financeCompanyId, productType, brandCd, modelCd },
        orderBy: [{ dtMdlCd: "asc" }, { vehiclePrice: "asc" }],
        select: {
          id: true, dtMdlCd: true, dtMdlName: true, mdelCd: true, trimName: true,
          modelYear: true, vehiclePrice: true, baseRates: true, warnings: true,
          depositRate36_10000: true, prepayRate36_10000: true,
          weekOf: true, scrapedAt: true,
        },
      });
      return NextResponse.json({ success: true, trims });
    }

    // 모델 목록 (브랜드 내)
    if (brandCd) {
      const models = await db.capitalCatalogTrim.groupBy({
        by: ["modelCd", "modelName"],
        where: { financeCompanyId, productType, brandCd },
        _count: { _all: true },
        _max: { scrapedAt: true },
      });
      return NextResponse.json({
        success: true,
        models: models
          .map((model) => ({
            modelCd: model.modelCd,
            modelName: model.modelName,
            trimCount: model._count._all,
            lastScrapedAt: model._max.scrapedAt,
          }))
          .sort((a, b) => a.modelName.localeCompare(b.modelName, "ko")),
      });
    }

    // 브랜드 요약
    const brands = await db.capitalCatalogTrim.groupBy({
      by: ["brandCd", "brandName"],
      where: { financeCompanyId, productType },
      _count: { _all: true },
      _max: { scrapedAt: true },
    });
    return NextResponse.json({
      success: true,
      brands: brands
        .map((brand) => ({
          brandCd: brand.brandCd,
          brandName: brand.brandName,
          trimCount: brand._count._all,
          lastScrapedAt: brand._max.scrapedAt,
        }))
        .sort((a, b) => b.trimCount - a.trimCount),
    });
  } catch (e) {
    console.error("[capital-catalog GET]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
