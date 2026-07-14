import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { latestYearLineupNames } from "@/lib/lineup-sort";

// GET /api/vehicles/:slug/trims
// 차량의 전체 트림 + 옵션 목록 반환
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { slug, isVisible: true },
      select: { id: true, name: true },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "차량을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const trims = await prisma.trim.findMany({
      where: { vehicleId: vehicle.id, isVisible: true },
      orderBy: [{ isDefault: "desc" }, { price: "asc" }],
      include: {
        options: {
          orderBy: [{ displayOrder: "asc" }, { isAccessory: "asc" }, { price: "asc" }],
          select: {
            id: true,
            name: true,
            price: true,
            category: true,
            description: true,
            isAccessory: true,
            isDefault: true,
            badge: { select: { label: true } },
          },
        },
        lineup: {
          select: { id: true, name: true, isVisible: true },
        },
        rules: {
          select: {
            id: true,
            ruleType: true,
            sourceOptionId: true,
            targetOptionId: true,
          },
        },
        rateSheets: {
          where: {
            isActive: true,
            financeCompany: { isActive: true },
          },
          select: { productType: true },
        },
      },
    });

    // 고객 노출 규칙:
    // 1) 운영자가 숨긴(isVisible=false) 라인업의 트림은 제외.
    // 2) 같은 차량군은 노출 라인업 중 최신 연식만 노출(이전 연식 완전 비노출).
    // 라인업이 없는 트림은 연식 그룹핑 대상이 아니므로 그대로 유지한다.
    const visibleTrims = trims.filter((t) => t.lineup?.isVisible !== false);
    const latestNames = latestYearLineupNames(
      visibleTrims.map((t) => t.lineup?.name).filter((n): n is string => Boolean(n))
    );
    const normallyFilteredTrims = visibleTrims.filter(
      (t) => !t.lineup || latestNames.has(t.lineup.name)
    );

    // 운영 데이터 동기화 과정에서 차량은 공개 상태지만 모든 라인업만 숨겨지는 경우가 있다.
    // 이때 고객이 원하는 트림조차 고르지 못하는 막다른 흐름이 생기므로, 전체 트림 중
    // 최신 연식만 복구 노출한다. 공개 라인업이 하나라도 있으면 기존 숨김 정책을 유지한다.
    const fallbackLatestNames = latestYearLineupNames(
      trims.map((t) => t.lineup?.name).filter((n): n is string => Boolean(n))
    );
    const filteredTrims = normallyFilteredTrims.length > 0
      ? normallyFilteredTrims
      : trims.filter((t) => !t.lineup || fallbackLatestNames.has(t.lineup.name));

    return NextResponse.json({
      success: true,
      data: filteredTrims.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        discountPrice: t.discountPrice,
        evSubsidy: t.evSubsidy,
        engineType: t.engineType,
        fuelEfficiency: t.fuelEfficiency,
        isDefault: t.isDefault,
        specs: t.specs,
        options: t.options.map(({ badge, ...o }) => ({
          ...o,
          badge: badge?.label ?? null,
        })),
        rules: t.rules,
        lineupId: t.lineupId,
        lineup: t.lineup ? { id: t.lineup.id, name: t.lineup.name } : null,
        availableProducts: Array.from(
          new Set(
            t.rateSheets
              .map((rateSheet) => rateSheet.productType)
              .filter((productType) => productType === "장기렌트" || productType === "리스")
          )
        ),
      })),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "트림 정보를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
