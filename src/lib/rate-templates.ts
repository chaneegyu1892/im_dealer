/**
 * 캐피탈 회수율 시트 자동 채우기 템플릿
 *
 * prisma/seed.ts 의 buildBaseRates / buildDepositRates / buildPrepayRates 로직을
 * 어드민 UI 에서 재사용하기 위해 분리. CLAUDE.md 의 견적 계산 규칙(시드 상수, 부호) 준수.
 */
import type { RateSheetRaw, RateSheetKey } from "@/types/admin";

// ─── 상수 (CLAUDE.md / seed.ts 와 동일) ──────────────────────
const DEPOSIT_DISCOUNT_RATE = -0.000523;
const PREPAY_ADJUST_RATE = 0.000073;

const MONTHS_ADJ: Record<number, number> = { 36: 1.20, 48: 1.00, 60: 0.84 };
const MILEAGE_ADJ: Record<number, number> = { 10000: 0.95, 20000: 1.00, 30000: 1.05 };

const MONTHS = [36, 48, 60] as const;
const MILEAGES = [10000, 20000, 30000] as const;

// ─── 기준 회수율 (48개월·2만km 기준) ──────────────────────
/**
 * brand / engineType 별 기준 회수율. seed.ts 의 getBaseRecoveryRate 와 동일.
 */
export function getBaseRecoveryRate(brand: string, engineType: string): number {
  if (brand === "제네시스") return 0.0222;
  if (engineType === "EV") return 0.0252;
  if (engineType === "하이브리드") return 0.0228;
  if (engineType === "디젤") return 0.0258;
  return 0.0242; // 가솔린 / LPG / 기타
}

// ─── 시트 생성 ──────────────────────────────────────────────
/** vehiclePrice × baseRate × monthsAdj × mileageAdj 로 9셀 채움 */
export function buildBaseRateSheet(vehiclePrice: number, baseRate: number): RateSheetRaw {
  const sheet = {} as RateSheetRaw;
  for (const months of MONTHS) {
    for (const mileage of MILEAGES) {
      const key = `${months}_${mileage}` as RateSheetKey;
      sheet[key] = Math.round(vehiclePrice * baseRate * MONTHS_ADJ[months] * MILEAGE_ADJ[mileage]);
    }
  }
  return sheet;
}

/** 보증금 10% 적용 시트 (기준 시트에서 일정 금액 차감) */
export function buildDepositRateSheet(baseSheet: RateSheetRaw, vehiclePrice: number): RateSheetRaw {
  const adj = Math.round(vehiclePrice * DEPOSIT_DISCOUNT_RATE); // 1 step (10%)
  const result = {} as RateSheetRaw;
  for (const key of Object.keys(baseSheet) as RateSheetKey[]) {
    result[key] = (baseSheet[key] ?? 0) + adj;
  }
  return result;
}

/** 선납금 10% 적용 시트 (월선납할인 + 추가조정 차감) */
export function buildPrepayRateSheet(baseSheet: RateSheetRaw, vehiclePrice: number): RateSheetRaw {
  const adjustAmount = vehiclePrice * PREPAY_ADJUST_RATE; // 1 step (10%)
  const result = {} as RateSheetRaw;
  for (const key of Object.keys(baseSheet) as RateSheetKey[]) {
    const months = parseInt(key.split("_")[0] ?? "48", 10);
    const monthlyPrepayDeduction = (vehiclePrice * 0.10) / months;
    result[key] = Math.round((baseSheet[key] ?? 0) - monthlyPrepayDeduction - adjustAmount);
  }
  return result;
}

// ─── 통합 함수 ──────────────────────────────────────────────
export interface AutoFilledSheets {
  base: RateSheetRaw;
  deposit: RateSheetRaw;
  prepay: RateSheetRaw;
}

/**
 * 차량가 + brand + engineType 만으로 base / deposit / prepay 시트 3개 자동 생성.
 * RateInputForm 의 "자동 채우기" 버튼이 이걸 호출.
 */
export function autoFillRateSheets(
  vehiclePrice: number,
  brand: string,
  engineType: string
): AutoFilledSheets {
  const baseRate = getBaseRecoveryRate(brand, engineType);
  const base = buildBaseRateSheet(vehiclePrice, baseRate);
  return {
    base,
    deposit: buildDepositRateSheet(base, vehiclePrice),
    prepay: buildPrepayRateSheet(base, vehiclePrice),
  };
}
