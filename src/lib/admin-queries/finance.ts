import { prisma } from "../prisma";
import type {
  AdminFinanceCompany,
  CapitalRateSheet,
  RateSheetRaw,
} from "@/types/admin";

interface RateSheetRow {
  id: string;
  financeCompanyId: string;
  trimId: string;
  weekOf: Date;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minBaseRates: unknown;
  minDepositRates: unknown;
  minPrepayRates: unknown;
  maxBaseRates: unknown;
  maxDepositRates: unknown;
  maxPrepayRates: unknown;
  minRateMatrix: unknown;
  maxRateMatrix: unknown;
  depositDiscountRate: number;
  prepayAdjustRate: number;
  isActive: boolean;
  memo: string | null;
  createdAt: Date;
  financeCompany: { name: string };
  trim: { name: string; lineup: { name: string } | null; vehicle: { name: string } };
}

function mapRateSheet(r: RateSheetRow): CapitalRateSheet {
  return {
    id: r.id,
    financeCompanyId: r.financeCompanyId,
    financeCompanyName: r.financeCompany.name,
    trimId: r.trimId,
    trimName: r.trim.name,
    vehicleName: r.trim.vehicle.name,
    lineupName: r.trim.lineup?.name ?? null,
    weekOf: r.weekOf.toISOString(),
    minVehiclePrice: r.minVehiclePrice,
    maxVehiclePrice: r.maxVehiclePrice,
    minBaseRates: r.minBaseRates as RateSheetRaw,
    minDepositRates: r.minDepositRates as RateSheetRaw,
    minPrepayRates: r.minPrepayRates as RateSheetRaw,
    maxBaseRates: r.maxBaseRates as RateSheetRaw,
    maxDepositRates: r.maxDepositRates as RateSheetRaw,
    maxPrepayRates: r.maxPrepayRates as RateSheetRaw,
    minRateMatrix: r.minRateMatrix as RateSheetRaw,
    maxRateMatrix: r.maxRateMatrix as RateSheetRaw,
    depositDiscountRate: r.depositDiscountRate,
    prepayAdjustRate: r.prepayAdjustRate,
    isActive: r.isActive,
    memo: r.memo,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getAdminFinanceCompanies(): Promise<AdminFinanceCompany[]> {
  const rows = await prisma.financeCompany.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    surchargeRate: r.surchargeRate,
    isActive: r.isActive,
    displayOrder: r.displayOrder,
  }));
}

/** 특정 캐피탈사의 최신 활성 시트 목록 */
export async function getActiveRateSheets(
  financeCompanyId: string
): Promise<CapitalRateSheet[]> {
  const db = prisma as any;
  const rows = await db.capitalRateSheet.findMany({
    where: { financeCompanyId, isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      financeCompany: { select: { name: true } },
      trim: {
        include: {
          vehicle: { select: { name: true } },
          lineup: { select: { name: true } },
        },
      },
    },
  });
  return rows.map(mapRateSheet);
}

/** 특정 트림의 이력 (주별 전체) */
export async function getRateSheetHistory(
  financeCompanyId: string,
  trimId: string
): Promise<CapitalRateSheet[]> {
  const db = prisma as any;
  const rows = await db.capitalRateSheet.findMany({
    where: { financeCompanyId, trimId },
    orderBy: { weekOf: "desc" },
    include: {
      financeCompany: { select: { name: true } },
      trim: {
        include: {
          vehicle: { select: { name: true } },
          lineup: { select: { name: true } },
        },
      },
    },
  });
  return rows.map(mapRateSheet);
}
