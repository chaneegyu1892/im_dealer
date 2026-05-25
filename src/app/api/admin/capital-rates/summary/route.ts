import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";

/**
 * GET /api/admin/capital-rates/summary
 *
 * 모든 활성(isActive=true) 시트의 라이트한 요약을 반환.
 * 시뮬레이터 좌측 차량 리스트에서 차량/라인업별 등록 상태 배지와
 * 우측 등록 캐피탈사 매트릭스 카드를 그릴 때 사용한다.
 *
 * 응답에는 견적 계산에 필요한 회수율 매트릭스/요율은 포함하지 않는다
 * (등록 여부 + 메타정보만 필요). 시뮬레이션 실행 시점에 trimId 기반으로
 * 정상 capital-rates 엔드포인트를 호출하여 상세값을 받는다.
 */
export async function GET() {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const rows = await (prisma as any).capitalRateSheet.findMany({
      where: { isActive: true },
      orderBy: { weekOf: "desc" },
      select: {
        id: true,
        financeCompanyId: true,
        productType: true,
        weekOf: true,
        trimId: true,
        financeCompany: { select: { name: true } },
        trim: {
          select: {
            id: true,
            name: true,
            lineupId: true,
            vehicleId: true,
            lineup: { select: { name: true } },
            vehicle: { select: { name: true, brand: true } },
          },
        },
      },
    });

    const data = rows.map((r: any) => ({
      sheetId: r.id,
      financeCompanyId: r.financeCompanyId,
      financeCompanyName: r.financeCompany.name,
      productType: r.productType,
      weekOf: r.weekOf.toISOString(),
      trimId: r.trimId,
      trimName: r.trim.name,
      lineupId: r.trim.lineupId,
      lineupName: r.trim.lineup?.name ?? null,
      vehicleId: r.trim.vehicleId,
      vehicleName: r.trim.vehicle.name,
      brand: r.trim.vehicle.brand,
    }));

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[GET /api/admin/capital-rates/summary]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
