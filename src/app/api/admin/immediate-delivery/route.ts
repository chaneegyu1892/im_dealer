import { NextResponse, type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { IMMEDIATE_DELIVERY_BRANDS } from "@/lib/immediate-delivery";

export const runtime = "nodejs";

// GET /api/admin/immediate-delivery?brand=기아&model=쏘렌토&stockType=NORMAL
// — 최신 배치에서 해당 모델의 재고 행 상세 조회(어드민 화면 펼침용)
export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const params = request.nextUrl.searchParams;
    const brand = params.get("brand") ?? "";
    const model = params.get("model") ?? "";
    const stockType = params.get("stockType") ?? "";
    if (!(IMMEDIATE_DELIVERY_BRANDS as readonly string[]).includes(brand) || !model) {
      return NextResponse.json({ error: "brand/model 파라미터가 필요합니다." }, { status: 400 });
    }

    const latest = await prisma.immediateDeliveryBatch.findFirst({
      where: { brand },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!latest) return NextResponse.json({ success: true, rows: [] });

    const rows = await prisma.immediateDeliveryStock.findMany({
      where: {
        batchId: latest.id,
        model,
        ...(stockType === "NORMAL" || stockType === "LIMITED" ? { stockType } : {}),
      },
      orderBy: [{ trimName: "asc" }, { exteriorColor: "asc" }],
      select: {
        id: true,
        stockType: true,
        salesCode: true,
        trimName: true,
        optionText: true,
        exteriorColor: true,
        interiorColor: true,
        price: true,
        discount: true,
        quantity: true,
        location: true,
        extra: true,
      },
    });
    return NextResponse.json({ success: true, rows });
  } catch (e) {
    console.error("[immediate-delivery GET]", e);
    return NextResponse.json({ error: "재고 조회 실패" }, { status: 500 });
  }
}

// DELETE /api/admin/immediate-delivery?brand=기아 — 해당 브랜드의 즉시출고 데이터 전체 삭제(행은 cascade)
export async function DELETE(request: NextRequest) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const brand = request.nextUrl.searchParams.get("brand") ?? "";
    if (!(IMMEDIATE_DELIVERY_BRANDS as readonly string[]).includes(brand)) {
      return NextResponse.json({ error: "지원하지 않는 브랜드입니다." }, { status: 400 });
    }
    const deleted = await prisma.immediateDeliveryBatch.deleteMany({ where: { brand } });
    await logAdminAction({
      request,
      actor: admin,
      action: "IMMEDIATE_DELIVERY_DELETE",
      resource: "ImmediateDeliveryBatch",
      meta: { brand, deletedBatches: deleted.count },
    });
    return NextResponse.json({ success: true, deletedBatches: deleted.count });
  } catch (e) {
    console.error("[immediate-delivery DELETE]", e);
    return NextResponse.json({ error: "삭제 처리 실패" }, { status: 500 });
  }
}
