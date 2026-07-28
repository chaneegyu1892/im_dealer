import type { RateSheetRaw } from "@/types/admin";
import {
  RATE_KEYS,
  calcDepositDiscountRate,
  calcPrepayAdjustRate,
} from "@/lib/quote-calculator";

function completeRates(partial: Partial<RateSheetRaw>): RateSheetRaw {
  return Object.fromEntries(RATE_KEYS.map((key) => [key, partial[key] ?? 0])) as RateSheetRaw;
}

/**
 * 실제로 쓸 수 있는 회수율이 하나라도 들어 있는지.
 *
 * 트림 목록은 얻었지만 요금 조회가 빈 응답을 주면 전 칸이 0 인 행이 저장된다.
 * 그 행을 "수집 완료"로 치면 같은 주 재수집에서 계속 건너뛰어 영영 채워지지 않는다.
 * 견적에도 쓸 수 없으므로 수집되지 않은 것으로 본다.
 */
export function hasUsableRates(baseRates: unknown): boolean {
  if (baseRates === null || typeof baseRates !== "object") return false;
  return Object.values(baseRates as Record<string, unknown>).some(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0
  );
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
