/** 9개 조합 키: "36_10000" | "36_20000" | ... | "60_30000" */
export type RateSheetKey =
  | "36_10000" | "36_20000" | "36_30000"
  | "48_10000" | "48_20000" | "48_30000"
  | "60_10000" | "60_20000" | "60_30000";

export type RateSheetRaw = Record<RateSheetKey, number>;

export interface CapitalRateSheet {
  id: string;
  financeCompanyId: string;
  financeCompanyName: string;
  trimId: string;
  trimName: string;
  vehicleName: string;
  lineupName: string | null;
  productType: string;
  weekOf: string;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minBaseRates: RateSheetRaw;
  minDepositRates: RateSheetRaw;
  minPrepayRates: RateSheetRaw;
  maxBaseRates: RateSheetRaw;
  maxDepositRates: RateSheetRaw;
  maxPrepayRates: RateSheetRaw;
  minRateMatrix: RateSheetRaw;
  maxRateMatrix: RateSheetRaw;
  depositDiscountRate: number;
  prepayAdjustRate: number;
  isActive: boolean;
  memo: string | null;
  createdAt: string;
}

export interface CapitalRateSheetInput {
  financeCompanyId: string;
  trimId: string;
  productType?: string;
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
}

export interface AdminFinanceCompany {
  id: string;
  name: string;
  code: string;
  surchargeRate: number;
  logoUrl: string | null;
  isActive: boolean;
  displayOrder: number;
}
