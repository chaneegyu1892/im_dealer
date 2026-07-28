import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { findModelIndex, matchTrim } from "@/lib/scraper/trim-match";

const suggestSchema = z.object({
  financeCompanyId: z.string().min(1),
  vehicleId: z.string().min(1),
  productType: z.string().min(1).default("장기렌트"),
});

// POST /api/admin/capital-catalog/mappings/suggest — 자동 매핑 제안 (저장하지 않음, 관리자 채택 시 mappings POST)
// 차량명↔카탈로그 모델명(3단 규칙) + 트림명 토큰 매칭 — 워커와 동일한 공유 로직.
export async function POST(request: NextRequest) {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const input = suggestSchema.parse(await request.json());
    const db = prisma;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      select: {
        name: true,
        trims: {
          where: { lineupId: { not: null } },
          select: { id: true, name: true, lineup: { select: { name: true } } },
        },
      },
    });
    if (!vehicle) return NextResponse.json({ error: "없는 차량" }, { status: 404 });

    // 카탈로그의 모델 목록에서 차량명 매칭
    const models = await db.capitalCatalogTrim.groupBy({
      by: ["modelCd", "modelName"],
      where: { financeCompanyId: input.financeCompanyId, productType: input.productType },
    });
    const mi = findModelIndex(vehicle.name, models.map((model) => model.modelName));
    if (mi < 0) {
      return NextResponse.json({
        success: true,
        modelName: null,
        suggestions: [],
        warning: `카탈로그에서 '${vehicle.name}' 모델을 찾지 못했습니다. 수동 매핑을 사용하세요.`,
      });
    }
    const model = models[mi];

    const candidates = await db.capitalCatalogTrim.findMany({
      where: { financeCompanyId: input.financeCompanyId, productType: input.productType, modelCd: model.modelCd },
      select: { id: true, trimName: true, modelYear: true, vehiclePrice: true, mdelCd: true },
    });
    const candList = candidates.map((candidate) => ({
      label: candidate.trimName,
      year: candidate.modelYear ?? "",
    }));

    const suggestions = vehicle.trims.map((t) => {
      const ourName = `${t.lineup?.name ?? ""} ${t.name}`.trim();
      const m = matchTrim(ourName, candList);
      const hit = m ? candidates[m.index] : undefined;
      return {
        trimId: t.id,
        trimName: ourName,
        suggestion: hit && m
          ? {
              catalogTrimId: hit.id,
              label: `${hit.trimName}${hit.modelYear ? ` [${hit.modelYear}]` : ""}`,
              vehiclePrice: hit.vehiclePrice,
              confidence: m.confidence,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, modelName: model.modelName, suggestions });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다.", details: e.flatten() }, { status: 400 });
    }
    console.error("[catalog suggest POST]", e);
    return NextResponse.json({ error: "제안 실패" }, { status: 500 });
  }
}
