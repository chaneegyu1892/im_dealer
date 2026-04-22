/**
 * 견적 계산 엔진 — 회수율(Recovery Rate) 기반
 *
 * 핵심 공식:
 *   기준 대여료 = 차량가 × 회수율
 *   보증금 적용 = 차량가 × (기준회수율 + 보증금할인회수율 × 보증금10%단위수)
 *   선납금 적용 = (기준대여료 - 선납금/개월수) - 차량가 × 선납금조정회수율 × 선납금10%단위수
 *   최종 대여료 = 보증금or선납금 적용 대여료 × (1+순위가산율) × (1+차량가산율) × (1+금융사가산율)
 */

import type {
  FinanceQuoteResult,
  QuoteBreakdown,
  SurchargeDetail,
} from "@/types/quote";
import type { RateSheetKey, RateSheetRaw } from "@/types/admin";

// ─── 입력 타입 ──────────────────────────────────────────

export interface RateConfigData {
  financeCompanyId: string;
  financeCompanyName: string;
  financeSurchargeRate: number;     // 금융사 가산율 (%)
  minVehiclePrice: number;          // 최소 차량가
  maxVehiclePrice: number;          // 최대 차량가
  minRateMatrix: RateSheetRaw;      // 최소가 기준 회수율 (9개)
  maxRateMatrix: RateSheetRaw;      // 최대가 기준 회수율 (9개)
  depositDiscountRate: number;      // 보증금 할인 회수율
  prepayAdjustRate: number;         // 선납금 조정 회수율
}

export interface CalcInput {
  vehiclePrice: number;
  contractMonths: number;           // 36 | 48 | 60
  annualMileage: number;            // 10000 | 20000 | 30000
  depositRate: number;              // 보증금 비율 (0, 10, 20, 30)
  prepayRate: number;               // 선납금 비율 (0, 10, 20, 30)
  vehicleSurchargeRate: number;     // 차량 가산율 (%)
  rankSurchargeRates: number[];     // [1순위%, 2순위%, 3순위%, 4순위+%]
  rateConfigs: RateConfigData[];    // 금융사별 회수율 데이터
}

// ─── 회수율 조회 ─────────────────────────────────────────

export function getRateFromMatrix(
  rateMatrix: RateSheetRaw,
  contractMonths: number,
  annualMileage: number
): number {
  const key = `${contractMonths}_${annualMileage}` as RateSheetKey;
  return rateMatrix[key] ?? 0;
}

/** 차량 실제 가격으로 min·max 사이를 선형보간한 회수율 반환 */
function getInterpolatedRate(
  config: RateConfigData,
  vehiclePrice: number,
  contractMonths: number,
  annualMileage: number
): number {
  const minRate = getRateFromMatrix(config.minRateMatrix, contractMonths, annualMileage);
  const maxRate = getRateFromMatrix(config.maxRateMatrix, contractMonths, annualMileage);
  if (minRate <= 0 && maxRate <= 0) return 0;
  if (config.maxVehiclePrice <= config.minVehiclePrice) return minRate;
  const t = Math.max(0, Math.min(1, (vehiclePrice - config.minVehiclePrice) / (config.maxVehiclePrice - config.minVehiclePrice)));
  return minRate + t * (maxRate - minRate);
}

// ─── 단일 금융사 기준 대여료 계산 ─────────────────────────

function calcBaseMonthly(vehiclePrice: number, recoveryRate: number): number {
  return vehiclePrice * recoveryRate;
}

/** 보증금 적용 월 대여료 계산 */
function applyDeposit(
  vehiclePrice: number,
  baseRate: number,
  depositRate: number,
  depositDiscountRate: number
): { monthly: number; depositAmount: number; discount: number } {
  const steps = depositRate / 10;
  const depositAmount = Math.round(vehiclePrice * (depositRate / 100));
  const adjustedRate = baseRate + depositDiscountRate * steps;
  const monthly = vehiclePrice * adjustedRate;
  const discount = Math.round(vehiclePrice * Math.abs(depositDiscountRate) * steps);
  return { monthly, depositAmount, discount };
}

/** 선납금 적용 월 대여료 계산 */
function applyPrepay(
  vehiclePrice: number,
  baseMonthly: number,
  contractMonths: number,
  prepayRate: number,
  prepayAdjustRate: number
): { monthly: number; prepayAmount: number; adjust: number } {
  const steps = prepayRate / 10;
  const prepayAmount = Math.round(vehiclePrice * (prepayRate / 100));
  const prepayDeduction = prepayAmount / contractMonths;
  const adjustAmount = vehiclePrice * prepayAdjustRate * steps;
  const monthly = baseMonthly - prepayDeduction - adjustAmount;
  return { monthly, prepayAmount, adjust: -(prepayDeduction + adjustAmount) };
}

// ─── 다중 금융사 견적 계산 (메인 함수) ──────────────────

export function calculateMultiFinanceQuote(input: CalcInput): FinanceQuoteResult[] {
  const {
    vehiclePrice,
    contractMonths,
    annualMileage,
    depositRate,
    prepayRate,
    vehicleSurchargeRate,
    rankSurchargeRates,
    rateConfigs,
  } = input;

  type Intermediate = {
    config: RateConfigData;
    recoveryRate: number;
    baseMonthly: number;
    monthlyBeforeSurcharge: number;
    depositAmount: number;
    prepayAmount: number;
    depositDiscount: number;
    prepayAdjust: number;
  };

  const intermediates: Intermediate[] = [];

  for (const cfg of rateConfigs) {
    const recoveryRate = getInterpolatedRate(cfg, vehiclePrice, contractMonths, annualMileage);
    if (recoveryRate <= 0) continue;

    const baseMonthly = calcBaseMonthly(vehiclePrice, recoveryRate);
    let monthlyBeforeSurcharge: number;
    let depositAmount = 0;
    let prepayAmount = 0;
    let depositDiscount = 0;
    let prepayAdjust = 0;

    if (depositRate > 0) {
      const result = applyDeposit(vehiclePrice, recoveryRate, depositRate, cfg.depositDiscountRate);
      monthlyBeforeSurcharge = result.monthly;
      depositAmount = result.depositAmount;
      depositDiscount = result.discount;
    } else if (prepayRate > 0) {
      const result = applyPrepay(vehiclePrice, baseMonthly, contractMonths, prepayRate, cfg.prepayAdjustRate);
      monthlyBeforeSurcharge = result.monthly;
      prepayAmount = result.prepayAmount;
      prepayAdjust = result.adjust;
    } else {
      monthlyBeforeSurcharge = baseMonthly;
    }

    intermediates.push({
      config: cfg,
      recoveryRate,
      baseMonthly,
      monthlyBeforeSurcharge,
      depositAmount,
      prepayAmount,
      depositDiscount,
      prepayAdjust,
    });
  }

  // 기본 대여료 기준 1차 정렬 (순위 결정)
  intermediates.sort((a, b) => a.monthlyBeforeSurcharge - b.monthlyBeforeSurcharge);

  // 순위 가산 → 차량 가산 → 금융사 가산 누적 곱셈
  const results: FinanceQuoteResult[] = intermediates.map((item, idx) => {
    const rank = idx + 1;
    const rankRate = rank <= rankSurchargeRates.length
      ? rankSurchargeRates[rank - 1]
      : rankSurchargeRates[rankSurchargeRates.length - 1];

    const afterRank    = item.monthlyBeforeSurcharge * (1 + rankRate / 100);
    const afterVehicle = afterRank * (1 + vehicleSurchargeRate / 100);
    const monthlyPayment = Math.round(afterVehicle * (1 + item.config.financeSurchargeRate / 100));

    const rankSurcharge    = Math.round(afterRank - item.monthlyBeforeSurcharge);
    const vehicleSurcharge = Math.round(afterVehicle - afterRank);
    const financeSurcharge = monthlyPayment - Math.round(afterVehicle);
    const totalSurcharge   = rankSurcharge + vehicleSurcharge + financeSurcharge;

    const breakdown: QuoteBreakdown = {
      vehiclePrice,
      recoveryRate: item.recoveryRate,
      baseMonthly: item.baseMonthly,
      depositAmount: item.depositAmount,
      prepayAmount: item.prepayAmount,
      depositDiscount: item.depositDiscount,
      prepayAdjust: item.prepayAdjust,
      monthlyBeforeSurcharge: item.monthlyBeforeSurcharge,
    };

    const surcharges: SurchargeDetail = {
      rankSurcharge,
      vehicleSurcharge,
      financeSurcharge,
      totalSurcharge,
    };

    return {
      financeCompanyId: item.config.financeCompanyId,
      financeCompanyName: item.config.financeCompanyName,
      rank,
      baseMonthly: item.monthlyBeforeSurcharge,
      monthlyPayment,
      breakdown,
      surcharges,
    };
  });

  results.sort((a, b) => a.monthlyPayment - b.monthlyPayment);
  results.forEach((r, i) => { r.rank = i + 1; });

  return results;
}

// ─── 단일 금융사 최저가 계산 (추천 미리보기용) ──────────

export function estimateMonthly(
  vehiclePrice: number,
  rateConfig: RateConfigData,
  contractMonths: number = 48,
  annualMileage: number = 20000
): number {
  const rate = getInterpolatedRate(rateConfig, vehiclePrice, contractMonths, annualMileage);
  return rate > 0 ? Math.round(vehiclePrice * rate) : 0;
}

// ─── 3개 시나리오 계산 (추천 결과 카드용) ────────────────

export interface ScenarioResult {
  monthlyPayment: number;
  depositAmount: number;
  prepayAmount: number;
  contractMonths: number;
  annualMileage: number;
  contractType: string;
}

export interface ScenarioResults {
  conservative: ScenarioResult;
  standard: ScenarioResult;
  aggressive: ScenarioResult;
}

export function calculateScenarios(
  vehiclePrice: number,
  rateConfig: RateConfigData,
  annualMileage: number = 20000,
  contractMonths: number = 48
): ScenarioResults {
  const rate = getInterpolatedRate(rateConfig, vehiclePrice, contractMonths, annualMileage);
  const baseMonthly = Math.round(vehiclePrice * rate);

  const conserv = applyDeposit(vehiclePrice, rate, 20, rateConfig.depositDiscountRate);
  const aggress = applyPrepay(vehiclePrice, baseMonthly, contractMonths, 30, rateConfig.prepayAdjustRate);

  return {
    conservative: {
      monthlyPayment: conserv.monthly,
      depositAmount: conserv.depositAmount,
      prepayAmount: 0,
      contractMonths,
      annualMileage,
      contractType: "반납형",
    },
    standard: {
      monthlyPayment: baseMonthly,
      depositAmount: 0,
      prepayAmount: 0,
      contractMonths,
      annualMileage,
      contractType: "반납형",
    },
    aggressive: {
      monthlyPayment: aggress.monthly,
      depositAmount: 0,
      prepayAmount: aggress.prepayAmount,
      contractMonths,
      annualMileage,
      contractType: "반납형",
    },
  };
}

// ─── 회수율 계산 헬퍼 (관리자 입력 시 자동 계산용) ─────────

export const RATE_KEYS: RateSheetKey[] = [
  "36_10000", "36_20000", "36_30000",
  "48_10000", "48_20000", "48_30000",
  "60_10000", "60_20000", "60_30000",
];

/** 캐피탈사 원본 견적 → 회수율 매트릭스 계산 */
export function calcRateMatrix(
  baseRates: RateSheetRaw,
  vehicleBasePrice: number
): RateSheetRaw {
  const result = {} as RateSheetRaw;
  for (const key of RATE_KEYS) {
    const monthly = baseRates[key] ?? 0;
    result[key] = monthly > 0
      ? Math.round((monthly / vehicleBasePrice) * 100_000) / 100_000
      : 0;
  }
  return result;
}

/** 보증금 10% 견적 → depositDiscountRate 계산 */
export function calcDepositDiscountRate(
  baseRates: RateSheetRaw,
  depositRates: RateSheetRaw,
  vehicleBasePrice: number
): number {
  const discounts: number[] = [];
  for (const key of RATE_KEYS) {
    const base = baseRates[key] ?? 0;
    const dep = depositRates[key] ?? 0;
    if (base > 0 && dep > 0) {
      discounts.push((dep - base) / vehicleBasePrice);
    }
  }
  if (discounts.length === 0) return 0;
  const avg = discounts.reduce((a, b) => a + b, 0) / discounts.length;
  return Math.round(avg * 100_000) / 100_000;
}

/** 선납금 10% 견적 → prepayAdjustRate 계산 */
export function calcPrepayAdjustRate(
  baseRates: RateSheetRaw,
  prepayRates: RateSheetRaw,
  vehicleBasePrice: number
): number {
  const adjustRates: number[] = [];
  for (const key of RATE_KEYS) {
    const [monthsStr] = key.split("_");
    const months = Number(monthsStr);
    const base = baseRates[key] ?? 0;
    const prepay = prepayRates[key] ?? 0;
    if (base > 0 && prepay > 0) {
      // 총할인 = base - prepay
      // 월선납할인 = vehicleBasePrice * 10% / months
      // 추가할인 = 총할인 - 월선납할인
      const totalDiscount = base - prepay;
      const monthlyPrepayDeduction = (vehicleBasePrice * 0.1) / months;
      const extraDiscount = totalDiscount - monthlyPrepayDeduction;
      adjustRates.push(extraDiscount / vehicleBasePrice);
    }
  }
  if (adjustRates.length === 0) return 0;
  const avg = adjustRates.reduce((a, b) => a + b, 0) / adjustRates.length;
  return Math.round(avg * 100_000) / 100_000;
}
