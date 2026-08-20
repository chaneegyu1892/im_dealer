import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import {
  IMMEDIATE_DELIVERY_BRANDS,
  parseImmediateDeliveryWorkbook,
  summarizeImmediateStock,
  snapshotDateFromFileName,
  type ImmediateDeliveryBrand,
} from "@/lib/immediate-delivery";

export const runtime = "nodejs";
export const maxDuration = 60;

const INSERT_CHUNK = 1000; // 현대 리스트가 1.4만 행 수준 — createMany 청크 분할

// POST /api/admin/immediate-delivery/upload — 제조사 재고리스트 엑셀 업로드.
// mode=preview: 파싱 요약만 반환(저장 안 함). 기본: 해당 브랜드 데이터를 새 배치로 통째 교체(스냅샷).
export async function POST(request: NextRequest) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "");
    const brandRaw = String(form.get("brand") ?? "");
    if (!(file instanceof File)) return NextResponse.json({ error: "재고리스트 엑셀 파일이 필요합니다." }, { status: 400 });
    if (!/\.xlsx?$/i.test(file.name)) return NextResponse.json({ error: "엑셀(.xls/.xlsx) 파일만 지원합니다." }, { status: 400 });
    const brandHint = (IMMEDIATE_DELIVERY_BRANDS as readonly string[]).includes(brandRaw)
      ? (brandRaw as ImmediateDeliveryBrand)
      : undefined;

    const buf = Buffer.from(await file.arrayBuffer());
    let parsed;
    try {
      parsed = parseImmediateDeliveryWorkbook(buf, brandHint);
    } catch (e) {
      // 브랜드 감지 실패 등 — 파서 메시지는 사용자 안내용으로 작성돼 있어 그대로 전달
      const msg = e instanceof Error ? e.message : "엑셀 파싱에 실패했습니다.";
      console.error("[immediate-delivery upload] parse failed:", msg);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const summary = summarizeImmediateStock(parsed);
    const snapshotDate = snapshotDateFromFileName(file.name);
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "파일에서 재고 행을 찾지 못했습니다. 양식이 맞는지 확인하세요." }, { status: 400 });
    }
    if (mode === "preview") {
      return NextResponse.json({ success: true, preview: true, summary, snapshotDate });
    }

    // 스냅샷 교체: 새 배치 생성 → 행 삽입 → 같은 브랜드의 이전 배치 삭제(행은 cascade)
    const batch = await prisma.$transaction(
      async (tx) => {
        const created = await tx.immediateDeliveryBatch.create({
          data: {
            brand: parsed.brand,
            fileName: file.name,
            rowCount: summary.rowCount,
            vehicleCount: summary.vehicleCount,
            warnings:
              parsed.warnings.length || parsed.skippedSheets.length
                ? { warnings: parsed.warnings, skippedSheets: parsed.skippedSheets, snapshotDate }
                : snapshotDate
                  ? { snapshotDate }
                  : Prisma.DbNull,
            createdById: admin.id,
          },
        });
        for (let i = 0; i < parsed.rows.length; i += INSERT_CHUNK) {
          await tx.immediateDeliveryStock.createMany({
            data: parsed.rows.slice(i, i + INSERT_CHUNK).map((r) => ({
              batchId: created.id,
              brand: parsed.brand,
              model: r.model,
              stockType: r.stockType,
              salesCode: r.salesCode ?? null,
              trimName: r.trimName,
              optionText: r.optionText ?? null,
              exteriorColor: r.exteriorColor ?? null,
              interiorColor: r.interiorColor ?? null,
              price: r.price ?? null,
              discount: r.discount ?? null,
              quantity: r.quantity,
              location: r.location ?? null,
              extra: r.extra ? (r.extra as Prisma.InputJsonValue) : Prisma.DbNull,
            })),
          });
        }
        await tx.immediateDeliveryBatch.deleteMany({
          where: { brand: parsed.brand, id: { not: created.id } },
        });
        return created;
      },
      { timeout: 55_000 },
    );

    await logAdminAction({
      request,
      actor: admin,
      action: "IMMEDIATE_DELIVERY_UPLOAD",
      resource: "ImmediateDeliveryBatch",
      targetId: batch.id,
      meta: {
        brand: parsed.brand,
        fileName: file.name,
        rowCount: summary.rowCount,
        vehicleCount: summary.vehicleCount,
        warnings: parsed.warnings.length,
        snapshotDate,
      },
    });

    return NextResponse.json({ success: true, batchId: batch.id, summary, snapshotDate });
  } catch (e) {
    console.error("[immediate-delivery upload POST]", e);
    return NextResponse.json({ error: "업로드 처리 실패" }, { status: 500 });
  }
}
