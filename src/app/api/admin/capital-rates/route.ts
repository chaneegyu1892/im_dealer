import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import {
  calcRateMatrix,
  calcDepositDiscountRate,
  calcPrepayAdjustRate,
} from "@/lib/quote-calculator";
import type { RateSheetRaw } from "@/types/admin";

// GET /api/admin/capital-rates?financeCompanyId=...&trimId=...&history=true
export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const financeCompanyId = searchParams.get("financeCompanyId");
  const trimId = searchParams.get("trimId");
  const history = searchParams.get("history") === "true";

  if (!financeCompanyId && !trimId) {
    return NextResponse.json({ error: "financeCompanyId 또는 trimId가 필요합니다." }, { status: 400 });
  }

  try {
    const where = {
      ...(financeCompanyId ? { financeCompanyId } : {}),
      ...(trimId ? { trimId } : {}),
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
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      financeCompanyId,
      trimId,
      trimIds,
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
    } = body as {
      financeCompanyId: string;
      trimId?: string;
      trimIds?: string[];
      weekOf: string;
      minVehiclePrice: number;
      maxVehiclePrice: number;
      minBaseRates: RateSheetRaw;
      minDepositRates: RateSheetRaw;
      minPrepayRates: RateSheetRaw;
      maxBaseRates: RateSheetRaw;
      maxDepositRates: RateSheetRaw;
      maxPrepayRates: RateSheetRaw;
      memo?: string;
    };

    const targetTrimIds = trimIds || (trimId ? [trimId] : []);

    if (!financeCompanyId || targetTrimIds.length === 0 || !weekOf || !minVehiclePrice || !maxVehiclePrice) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    // 회수율 자동 계산 (모든 트림에 동일하게 적용됨)
    const minRateMatrix = calcRateMatrix(minBaseRates, minVehiclePrice);
    const maxRateMatrix = calcRateMatrix(maxBaseRates, maxVehiclePrice);

    const depositDiscountRate = calcDepositDiscountRate(minBaseRates, minDepositRates, minVehiclePrice);
    const prepayAdjustRate = calcPrepayAdjustRate(minBaseRates, minPrepayRates, minVehiclePrice);

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
            financeCompanyId_trimId_weekOf: { financeCompanyId, trimId: tid, weekOf: weekDate },
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
            where: { financeCompanyId, trimId: tid, isActive: true },
            data: { isActive: false },
          });
          const created = await (tx as any).capitalRateSheet.create({
            data: { financeCompanyId, trimId: tid, weekOf: weekDate, ...sheetData },
          });
          saved.push(created.id);
        }
      }

      return saved;
    });

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
