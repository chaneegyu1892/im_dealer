import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { applyCatalogSchema } from "@/lib/validations/admin";
import { calcRateMatrix, RATE_KEYS } from "@/lib/quote-calculator";
import { buildCollectedRateData } from "@/lib/scraper/rate-matrices";
import type { RateSheetRaw } from "@/types/admin";

type CatalogSheetData = Omit<
  Prisma.CapitalRateSheetUncheckedCreateInput,
  "financeCompanyId" | "trimId" | "productType" | "weekOf"
>;

// POST /api/admin/capital-rates/apply-catalog — 매핑된 카탈로그 트림을 정확값 시트로 반영.
// 시트는 min=max=카탈로그 차량가(트림별 정확값, 보간 없음 — quote-calculator 의 min==max 가드가 처리).
export async function POST(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const input = applyCatalogSchema.parse(await request.json());
    const db = prisma;
    const weekDate = new Date(input.weekOf);

    // 매핑 → 카탈로그 행 로드
    const mappings = await db.capitalTrimMapping.findMany({
      where: {
        financeCompanyId: input.financeCompanyId,
        productType: input.productType,
        trimId: { in: input.trimIds },
      },
      include: {
        catalogTrim: {
          select: {
            vehiclePrice: true,
            baseRates: true,
            depositRate36_10000: true,
            prepayRate36_10000: true,
            trimName: true,
            modelYear: true,
            mdelCd: true,
          },
        },
      },
    });
    const byTrim = new Map(mappings.map((mapping) => [mapping.trimId, mapping] as const));

    const warnings: string[] = [];
    const targets: { trimId: string; sheetData: CatalogSheetData }[] = [];
    for (const trimId of input.trimIds) {
      const m = byTrim.get(trimId);
      if (!m) {
        warnings.push(`${trimId}: 매핑 없음 — 건너뜀`);
        continue;
      }
      const cat = m.catalogTrim;
      const baseRates = cat.baseRates as RateSheetRaw;
      const hasAny = RATE_KEYS.some((k) => (baseRates?.[k] ?? 0) > 0);
      if (!hasAny || !(cat.vehiclePrice > 0)) {
        warnings.push(`${m.externalLabel}: 수집값 없음(9칸 전부 0) — 건너뜀`);
        continue;
      }
      const collected = buildCollectedRateData(
        baseRates,
        cat.vehiclePrice,
        cat.depositRate36_10000,
        cat.prepayRate36_10000
      );
      if (collected.depositDiscountRate > 0) {
        warnings.push(`${m.externalLabel}: 보증금 적용 견적이 기준 견적보다 높아 건너뜀`);
        continue;
      }
      const rateMatrix = calcRateMatrix(collected.baseRates, cat.vehiclePrice);
      targets.push({
        trimId,
        sheetData: {
          // 정확값: min=max (보간 없음)
          minVehiclePrice: cat.vehiclePrice,
          maxVehiclePrice: cat.vehiclePrice,
          minBaseRates: collected.baseRates,
          maxBaseRates: collected.baseRates,
          minDepositRates: collected.depositRates,
          minPrepayRates: collected.prepayRates,
          maxDepositRates: collected.depositRates,
          maxPrepayRates: collected.prepayRates,
          minRateMatrix: rateMatrix,
          maxRateMatrix: rateMatrix,
          depositDiscountRate: collected.depositDiscountRate,
          prepayAdjustRate: collected.prepayAdjustRate,
          isActive: true,
          memo: `카탈로그 반영: ${cat.trimName}${cat.modelYear ? ` [${cat.modelYear}]` : ""} (${cat.mdelCd})`,
        },
      });
    }

    if (targets.length === 0) {
      return NextResponse.json({ error: "반영할 수 있는 트림이 없습니다.", warnings }, { status: 400 });
    }

    // 기존 POST /api/admin/capital-rates 와 동일한 주간 전환 규약 (weekOf 충돌 시 update, 아니면 활성 전환 후 create)
    const sheetIds = await prisma.$transaction(async (tx) => {
      const saved: string[] = [];
      for (const { trimId, sheetData } of targets) {
        const existing = await tx.capitalRateSheet.findUnique({
          where: {
            financeCompanyId_trimId_weekOf_productType: {
              financeCompanyId: input.financeCompanyId,
              trimId,
              weekOf: weekDate,
              productType: input.productType,
            },
          },
        });
        if (existing) {
          const updated = await tx.capitalRateSheet.update({
            where: { id: existing.id },
            data: sheetData,
          });
          saved.push(updated.id);
        } else {
          await tx.capitalRateSheet.updateMany({
            where: { financeCompanyId: input.financeCompanyId, trimId, productType: input.productType, isActive: true },
            data: { isActive: false },
          });
          const created = await tx.capitalRateSheet.create({
            data: {
              financeCompanyId: input.financeCompanyId,
              trimId,
              productType: input.productType,
              weekOf: weekDate,
              ...sheetData,
            },
          });
          saved.push(created.id);
        }
      }
      return saved;
    });

    await logAdminAction({
      request,
      actor: session,
      action: "RATE_SHEET_APPLY_CATALOG",
      resource: "CapitalRateSheet",
      meta: {
        financeCompanyId: input.financeCompanyId,
        productType: input.productType,
        weekOf: input.weekOf,
        applied: sheetIds.length,
        skipped: warnings.length,
      },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, applied: sheetIds.length, sheetIds, warnings });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "입력값이 올바르지 않습니다.", details: e.flatten() }, { status: 400 });
    }
    console.error("[apply-catalog POST]", e);
    return NextResponse.json({ error: "반영 실패" }, { status: 500 });
  }
}
