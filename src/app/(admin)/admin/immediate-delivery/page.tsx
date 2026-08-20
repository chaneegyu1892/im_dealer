import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { IMMEDIATE_DELIVERY_BRANDS } from "@/lib/immediate-delivery";
import { ImmediateDeliveryClient } from "./ImmediateDeliveryClient";

export type ModelSummary = {
  model: string;
  stockType: string; // "NORMAL" | "LIMITED"
  rows: number;
  quantity: number;
};

export type BrandSnapshot = {
  brand: string;
  batchId: string;
  fileName: string;
  rowCount: number;
  vehicleCount: number;
  snapshotDate: string | null;
  warnings: string[];
  skippedSheets: string[];
  uploadedAt: string;
  models: ModelSummary[];
};

// 브랜드별 최신 배치 + 모델 단위 집계만 서버에서 내려준다.
// 행 상세(현대 1.4만 행 수준)는 클라이언트가 모델 펼침 시 GET API로 가져온다.
async function getBrandSnapshots(): Promise<BrandSnapshot[]> {
  const snapshots: BrandSnapshot[] = [];
  for (const brand of IMMEDIATE_DELIVERY_BRANDS) {
    const batch = await prisma.immediateDeliveryBatch.findFirst({
      where: { brand },
      orderBy: { createdAt: "desc" },
    });
    if (!batch) continue;

    const grouped = await prisma.immediateDeliveryStock.groupBy({
      by: ["model", "stockType"],
      where: { batchId: batch.id },
      _count: { _all: true },
      _sum: { quantity: true },
    });

    const meta = (batch.warnings ?? {}) as {
      warnings?: string[];
      skippedSheets?: string[];
      snapshotDate?: string;
    };

    snapshots.push({
      brand,
      batchId: batch.id,
      fileName: batch.fileName,
      rowCount: batch.rowCount,
      vehicleCount: batch.vehicleCount,
      snapshotDate: meta.snapshotDate ?? null,
      warnings: meta.warnings ?? [],
      skippedSheets: meta.skippedSheets ?? [],
      uploadedAt: batch.createdAt.toISOString(),
      models: grouped
        .map((g) => ({
          model: g.model,
          stockType: g.stockType,
          rows: g._count._all,
          quantity: g._sum.quantity ?? 0,
        }))
        .sort((a, b) => a.model.localeCompare(b.model, "ko") || a.stockType.localeCompare(b.stockType)),
    });
  }
  return snapshots;
}

export default async function AdminImmediateDeliveryPage() {
  const snapshots = await getBrandSnapshots();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-[#F8F9FC]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#000666]"></div>
        </div>
      }
    >
      <ImmediateDeliveryClient snapshots={snapshots} />
    </Suspense>
  );
}
