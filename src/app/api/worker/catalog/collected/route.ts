import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";

// GET /api/worker/catalog/collected?financeCompanyId=&productType=&weekOf=
// 이번주(weekOf) 이미 수집된 외부 트림코드(mdelCd) 목록 — 워커가 재개 시 스킵 판정에 사용.
export async function GET(request: NextRequest) {
  const { error } = requireWorker(request);
  if (error) return error;

  try {
    const sp = new URL(request.url).searchParams;
    const financeCompanyId = sp.get("financeCompanyId");
    const productType = sp.get("productType");
    const weekOf = sp.get("weekOf");
    if (!financeCompanyId || !productType || !weekOf || !/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) {
      return NextResponse.json({ error: "financeCompanyId/productType/weekOf(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    const rows = await prisma.capitalCatalogTrim.findMany({
      where: { financeCompanyId, productType, weekOf: new Date(weekOf) },
      select: { mdelCd: true },
    });
    return NextResponse.json({ mdelCds: rows.map((r: { mdelCd: string }) => r.mdelCd) });
  } catch (e) {
    console.error("[worker catalog collected]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
