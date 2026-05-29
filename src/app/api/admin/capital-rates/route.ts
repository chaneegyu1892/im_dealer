import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import {
  calcRateMatrix,
  calcDepositDiscountRate,
  calcPrepayAdjustRate,
} from "@/lib/quote-calculator";
import type { RateSheetRaw } from "@/types/admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

// 회수율 시트는 모든 고객 견적 계산의 기반이 되는 금융 데이터다.
// 잘못된 구조(배열/null/문자열)나 음수·역전 가격이 calcRateMatrix 로 유입되지 않도록 엄격히 검증.
const rateSheet = z.record(z.string(), z.number()).transform((v) => v as RateSheetRaw);
const capitalRatePostSchema = z
  .object({
    financeCompanyId: z.string().min(1),
    trimId: z.string().min(1).optional(),
    trimIds: z.array(z.string().min(1)).optional(),
    productType: z.enum(["장기렌트", "리스"]).default("장기렌트"),
    weekOf: z
      .string()
      .min(1)
      .refine((s) => !Number.isNaN(new Date(s).getTime()), "weekOf 가 유효한 날짜가 아닙니다."),
    minVehiclePrice: z.number().positive(),
    maxVehiclePrice: z.number().positive(),
    minBaseRates: rateSheet,
    minDepositRates: rateSheet,
    minPrepayRates: rateSheet,
    maxBaseRates: rateSheet,
    maxDepositRates: rateSheet,
    maxPrepayRates: rateSheet,
    memo: z.string().nullish(),
  })
  .refine((d) => (d.trimIds?.length ?? 0) > 0 || !!d.trimId, "트림을 1개 이상 지정하세요.")
  .refine((d) => d.minVehiclePrice < d.maxVehiclePrice, "최소 차량가는 최대 차량가보다 작아야 합니다.");

// GET /api/admin/capital-rates?financeCompanyId=...&trimId=...&history=true
export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const financeCompanyId = searchParams.get("financeCompanyId");
  const trimId = searchParams.get("trimId");
  const productType = searchParams.get("productType");
  const history = searchParams.get("history") === "true";

  if (!financeCompanyId && !trimId) {
    return NextResponse.json({ error: "financeCompanyId 또는 trimId가 필요합니다." }, { status: 400 });
  }

  try {
    const where = {
      ...(financeCompanyId ? { financeCompanyId } : {}),
      ...(trimId ? { trimId } : {}),
      ...(productType ? { productType } : {}),
      ...(!history ? { isActive: true } : {}),
    };

    const rows = await (prisma as any).capitalRateSheet.findMany({
      where,
      orderBy: { weekOf: "desc" },
      include: {
        financeCompany: { select: { name: true, surchargeRate: true } },
        trim: {
          include: {
            vehicle: { select: { name: true, brand: true } },
            lineup: { select: { name: true } },
          },
        },
      },
    });

    const data = rows.map((r: any) => ({
      id: r.id,
      financeCompanyId: r.financeCompanyId,
      financeCompany: { name: r.financeCompany.name, surchargeRate: r.financeCompany.surchargeRate },
      trimId: r.trimId,
      trimName: r.trim.name,
      vehicleName: r.trim.vehicle.name,
      vehicleBrand: r.trim.vehicle.brand,
      lineupName: r.trim.lineup?.name ?? null,
      productType: r.productType,
      weekOf: r.weekOf.toISOString(),
      minVehiclePrice: r.minVehiclePrice,
      maxVehiclePrice: r.maxVehiclePrice,
      minBaseRates: r.minBaseRates,
      minDepositRates: r.minDepositRates,
      minPrepayRates: r.minPrepayRates,
      maxBaseRates: r.maxBaseRates,
      maxDepositRates: r.maxDepositRates,
      maxPrepayRates: r.maxPrepayRates,
      minRateMatrix: r.minRateMatrix,
      maxRateMatrix: r.maxRateMatrix,
      depositDiscountRate: r.depositDiscountRate,
      prepayAdjustRate: r.prepayAdjustRate,
      isActive: r.isActive,
      memo: r.memo,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// POST /api/admin/capital-rates — 신규 주별 시트 저장
export async function POST(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const parsed = capitalRatePostSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const {
      financeCompanyId,
      trimId,
      trimIds,
      productType,
      weekOf,
      minVehiclePrice,
      maxVehiclePrice,
      minBaseRates,
      minDepositRates,
      minPrepayRates,
      maxBaseRates,
      maxDepositRates,
      maxPrepayRates,
      memo,
    } = parsed.data;

    const targetTrimIds = trimIds && trimIds.length > 0 ? trimIds : trimId ? [trimId] : [];

    // 회수율 자동 계산 (모든 트림에 동일하게 적용됨)
    const minRateMatrix = calcRateMatrix(minBaseRates, minVehiclePrice);
    const maxRateMatrix = calcRateMatrix(maxBaseRates, maxVehiclePrice);

    const depositDiscountRate = calcDepositDiscountRate(minBaseRates, minDepositRates, minVehiclePrice);
    const prepayAdjustRate = calcPrepayAdjustRate(minBaseRates, minPrepayRates, minVehiclePrice);

    // 보증금은 할인 전용 정책. 보증금 적용 견적이 기준 견적보다 비싸면(=가산 결과) 차단.
    if (depositDiscountRate > 0) {
      return NextResponse.json(
        {
          error:
            "보증금 적용 월 지불액이 기준 월 지불액보다 높습니다. 보증금은 할인(Deposit Discount) 전용이며 가산은 적용할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const weekDate = new Date(weekOf);
    const db = prisma as any;

    const sheetData = {
      minVehiclePrice,
      maxVehiclePrice,
      minBaseRates,
      minDepositRates,
      minPrepayRates,
      maxBaseRates,
      maxDepositRates,
      maxPrepayRates,
      minRateMatrix,
      maxRateMatrix,
      depositDiscountRate,
      prepayAdjustRate,
      isActive: true,
      memo: memo ?? null,
    };

    const results = await prisma.$transaction(async (tx) => {
      const saved: string[] = [];

      for (const tid of targetTrimIds) {
        const existing = await (tx as any).capitalRateSheet.findUnique({
          where: {
            financeCompanyId_trimId_weekOf_productType: {
              financeCompanyId,
              trimId: tid,
              weekOf: weekDate,
              productType,
            },
          },
        });

        if (existing) {
          const updated = await (tx as any).capitalRateSheet.update({
            where: { id: existing.id },
            data: sheetData,
          });
          saved.push(updated.id);
        } else {
          await (tx as any).capitalRateSheet.updateMany({
            where: { financeCompanyId, trimId: tid, productType, isActive: true },
            data: { isActive: false },
          });
          const created = await (tx as any).capitalRateSheet.create({
            data: { financeCompanyId, trimId: tid, productType, weekOf: weekDate, ...sheetData },
          });
          saved.push(created.id);
        }
      }

      return saved;
    });

    await logAdminAction({
      request,
      actor: session,
      action: "RATE_SHEET_CREATE",
      resource: "CapitalRateSheet",
      meta: {
        financeCompanyId,
        trimIds: targetTrimIds,
        productType,
        weekOf,
        sheetIds: results,
        minVehiclePrice,
        maxVehiclePrice,
      },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({
      success: true,
      count: results.length,
      minRateMatrix,
      maxRateMatrix,
      depositDiscountRate,
      prepayAdjustRate
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
