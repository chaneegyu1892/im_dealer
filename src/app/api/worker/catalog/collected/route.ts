import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { hasUsableRates } from "@/lib/scraper/rate-matrices";

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
      select: { mdelCd: true, baseRates: true },
    });

    // 모델(mdelCd) 단위로 스킵 판정한다. 트림 중 하나라도 쓸 수 있는 회수율이 있으면
    // 수집된 것으로 보고, 전부 0 이면 수집되지 않은 것으로 봐 다음 실행에서 재시도한다.
    // (요금 조회가 빈 응답을 줘 0 으로 저장된 행이 영구히 스킵되던 문제)
    const usableByModel = new Map<string, boolean>();
    for (const row of rows) {
      const prev = usableByModel.get(row.mdelCd) ?? false;
      usableByModel.set(row.mdelCd, prev || hasUsableRates(row.baseRates));
    }

    const mdelCds = [...usableByModel.entries()]
      .filter(([, usable]) => usable)
      .map(([mdelCd]) => mdelCd);

    return NextResponse.json({ mdelCds });
  } catch (e) {
    console.error("[worker catalog collected]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
