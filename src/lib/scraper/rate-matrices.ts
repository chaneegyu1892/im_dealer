import type { RateSheetRaw } from "@/types/admin";
import {
  RATE_KEYS,
  calcDepositDiscountRate,
  calcPrepayAdjustRate,
} from "@/lib/quote-calculator";

function completeRates(partial: Partial<RateSheetRaw>): RateSheetRaw {
  return Object.fromEntries(RATE_KEYS.map((key) => [key, partial[key] ?? 0])) as RateSheetRaw;
}

export function buildCollectedRateData(
  partialBaseRates: Partial<RateSheetRaw>,
  vehiclePrice: number,
  depositRate36_10000?: number | null,
  prepayRate36_10000?: number | null
) {
  if (vehiclePrice <= 0) throw new Error("차량가는 양수여야 합니다.");
  const baseRates = completeRates(partialBaseRates);
  const depositRates = completeRates(
    depositRate36_10000 && depositRate36_10000 > 0
      ? { "36_10000": depositRate36_10000 }
      : {}
  );
  const prepayRates = completeRates(
    prepayRate36_10000 && prepayRate36_10000 > 0
      ? { "36_10000": prepayRate36_10000 }
      : {}
  );
  return {
    baseRates,
    depositRates,
    prepayRates,
    depositDiscountRate: calcDepositDiscountRate(baseRates, depositRates, vehiclePrice),
    prepayAdjustRate: calcPrepayAdjustRate(baseRates, prepayRates, vehiclePrice),
  };
}
