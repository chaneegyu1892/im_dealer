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
  productType: string;
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
    productType: r.productType,
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
    logoUrl: r.logoUrl,
    isActive: r.isActive,
    displayOrder: r.displayOrder,
  }));
}

