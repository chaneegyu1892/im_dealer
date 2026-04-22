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

  if (!financeCompanyId) {
    return NextResponse.json({ error: "financeCompanyId가 필요합니다." }, { status: 400 });
  }

  try {
    const where = {
      financeCompanyId,
      ...(trimId ? { trimId } : {}),
      ...(!history ? { isActive: true } : {}),
    };

    const rows = await (prisma as any).capitalRateSheet.findMany({
      where,
      orderBy: { weekOf: "desc" },
      include: {
        financeCompany: { select: { name: true } },
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
      financeCompanyName: r.financeCompany.name,
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

    return NextResponse.json(data);
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
      trimId: string;
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

    if (!financeCompanyId || !trimId || !weekOf || !minVehiclePrice || !maxVehiclePrice) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }

    // 회수율 자동 계산
    const minRateMatrix = calcRateMatrix(minBaseRates, minVehiclePrice);
    const maxRateMatrix = calcRateMatrix(maxBaseRates, maxVehiclePrice);

    // 보증금/선납금 조정률: min·max 각각 계산 후 평균 (차량가 범위 전체 반영)
    const depositMin = calcDepositDiscountRate(minBaseRates, minDepositRates, minVehiclePrice);
    const depositMax = calcDepositDiscountRate(maxBaseRates, maxDepositRates, maxVehiclePrice);
    const depositDiscountRate = Math.round(((depositMin + depositMax) / 2) * 100_000) / 100_000;

    const prepayMin = calcPrepayAdjustRate(minBaseRates, minPrepayRates, minVehiclePrice);
    const prepayMax = calcPrepayAdjustRate(maxBaseRates, maxPrepayRates, maxVehiclePrice);
    const prepayAdjustRate = Math.round(((prepayMin + prepayMax) / 2) * 100_000) / 100_000;

    const weekDate = new Date(weekOf);
    const db = prisma as any;

    const existing = await db.capitalRateSheet.findUnique({
      where: {
        financeCompanyId_trimId_weekOf: { financeCompanyId, trimId, weekOf: weekDate },
      },
    });

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

    let sheet;
    if (existing) {
      sheet = await db.capitalRateSheet.update({
        where: { id: existing.id },
        data: sheetData,
      });
    } else {
      await db.capitalRateSheet.updateMany({
        where: { financeCompanyId, trimId, isActive: true },
        data: { isActive: false },
      });
      sheet = await db.capitalRateSheet.create({
        data: { financeCompanyId, trimId, weekOf: weekDate, ...sheetData },
      });
    }

    return NextResponse.json({ id: sheet.id, minRateMatrix, maxRateMatrix, depositDiscountRate, prepayAdjustRate });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
