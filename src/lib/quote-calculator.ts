/**
 * 견적 계산 엔진 — 회수율(Recovery Rate) 기반
 *
 * 핵심 공식:
 *   기준 대여료      = 차량가 × 회수율
 *   보증금 적용 대여료 = 차량가 × (기준회수율 + 보증금할인회수율 × 보증금10%단위수)
 *                     (depositDiscountRate 는 음수만 허용 — 할인 전용)
 *   선납금 적용 대여료 = 기준대여료 - 선납금/개월수 + 차량가 × 선납금조정회수율 × 선납금10%단위수
 *                     (prepayAdjustRate 는 부호 자유 — 양수=가산, 음수=할인)
 *
 *   가산 월 추가금(i) = 차량가 × 가산율_i / 100 ÷ 계약개월수
 *   최종 대여료      = 보증금or선납금 적용 대여료
 *                     + 월 추가금(순위) + 월 추가금(차량) + 월 추가금(금융사)
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

/** 차량 실제 가격으로 min·max 사이를 선형보간한 회수율 반환 (외삽 금지 — t를 [0,1]로 클램프) */
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

/** 차량가가 회수율 시트 범위(min~max)를 벗어났는지 검사 */
export function isVehiclePriceOutOfRange(
  config: Pick<RateConfigData, "minVehiclePrice" | "maxVehiclePrice">,
  vehiclePrice: number
): boolean {
  return vehiclePrice < config.minVehiclePrice || vehiclePrice > config.maxVehiclePrice;
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

/**
 * 선납금 적용 월 대여료 계산
 *
 * - 선납금 분할 차감(prepayAmount / months)은 실제로 미리 낸 돈이므로 항상 차감.
 * - prepayAdjustRate 항(`차량가 × rate × 단위수`)은 부호 그대로 반영.
 *   양수면 가산, 음수면 할인.
 */
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
  const monthly = baseMonthly - prepayDeduction + adjustAmount;
  return { monthly, prepayAmount, adjust: -prepayDeduction + adjustAmount };
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

  // 가산 월 추가금 = (차량가 × 가산율 / 100) ÷ 계약개월수
  // 순위/차량/금융사 각 항목을 따로 계산해 단순 합산 (누적 곱셈 X)
  const perMonthSurcharge = (rate: number): number =>
    (vehiclePrice * (rate / 100)) / contractMonths;

  const results: FinanceQuoteResult[] = intermediates.map((item, idx) => {
    const rank = idx + 1;
    const rankRate = rank <= rankSurchargeRates.length
      ? rankSurchargeRates[rank - 1]
      : rankSurchargeRates[rankSurchargeRates.length - 1];

    const rankSurchargeRaw    = perMonthSurcharge(rankRate);
    const vehicleSurchargeRaw = perMonthSurcharge(vehicleSurchargeRate);
    const financeSurchargeRaw = perMonthSurcharge(item.config.financeSurchargeRate);
    const totalSurchargeRaw   = rankSurchargeRaw + vehicleSurchargeRaw + financeSurchargeRaw;

    const monthlyPayment = Math.round(item.monthlyBeforeSurcharge + totalSurchargeRaw);

    const rankSurcharge    = Math.round(rankSurchargeRaw);
    const vehicleSurcharge = Math.round(vehicleSurchargeRaw);
    const financeSurcharge = Math.round(financeSurchargeRaw);
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
      rangeExceeded: isVehiclePriceOutOfRange(item.config, vehiclePrice),
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

/**
 * 보증금 10% 견적 → depositDiscountRate 계산
 *
 * 부호 컨벤션: 음수 = 할인 (정상), 양수 = 가산 (정책 위반, API에서 차단됨).
 * - 운영자가 dep < base (보증금 적용가가 기본가보다 낮음 = 할인 의도) 로 입력하면 음수 반환.
 * - dep > base (실수로 더 높게 입력) 이면 양수 반환 → 어드민 API 가 400 으로 차단.
 *
 * calculator 의 applyDeposit 가 `baseRate + depositDiscountRate × steps` 식이므로
 * 음수 반환 시 회수율이 감소 → 월대여료 감소 → 할인이 자연스럽게 적용된다.
 */
export function calcDepositDiscountRate(
  baseRates: RateSheetRaw,
  depositRates: RateSheetRaw,
  vehicleBasePrice: number
): number {
  const adjustRates: number[] = [];
  for (const key of RATE_KEYS) {
    const base = baseRates[key] ?? 0;
    const dep = depositRates[key] ?? 0;
    if (base > 0 && dep > 0) {
      // dep < base (정상 할인) → 음수, dep > base (잘못된 입력) → 양수
      adjustRates.push((dep - base) / vehicleBasePrice);
    }
  }
  if (adjustRates.length === 0) return 0;
  const avg = adjustRates.reduce((a, b) => a + b, 0) / adjustRates.length;
  return Math.round(avg * 100_000) / 100_000;
}

/**
 * 선납금 10% 견적 → prepayAdjustRate 계산
 *
 * 부호 컨벤션: 양수 = 가산, 음수 = 할인.
 * 캐피탈사가 선납금에 추가 할인을 주면 결과는 음수, 추가 가산을 매기면 양수.
 */
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
      // 캐피탈 견적 표기 기준 추가가산액 = (실제 월지불액 - 기본 월지불액) + 월 선납금 분할차감
      //   prepay - base 가 음수면 할인, 양수면 가산.
      //   prepayDeduction(선납금 분할차감)은 견적상 이미 base 대비 -로 들어가 있으므로 더해 보정.
      const monthlyPrepayDeduction = (vehicleBasePrice * 0.1) / months;
      const extraSurcharge = (prepay - base) + monthlyPrepayDeduction;
      adjustRates.push(extraSurcharge / vehicleBasePrice);
    }
  }
  if (adjustRates.length === 0) return 0;
  const avg = adjustRates.reduce((a, b) => a + b, 0) / adjustRates.length;
  return Math.round(avg * 100_000) / 100_000;
}
