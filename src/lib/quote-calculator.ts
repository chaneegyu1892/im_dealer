/**
 * 견적 계산 엔진 — 회수율(Recovery Rate) 기반
 *
 * 핵심 공식:
 *   기준 대여료 = 차량가 × 회수율(선형보간)
 *   보증금 적용 = 차량가 × (기준회수율 + 보증금할인회수율 × 보증금10%단위수)
 *   선납금 적용 = (기준대여료 - 선납금/개월수) + 차량가 × 선납금조정회수율 × 선납금10%단위수
 *   최종 대여료 = 보증금or선납금 적용 대여료 × (1+순위가산율) × (1+차량가산율) × (1+금융사가산율)
 */

import type {
  RateMatrix,
  FinanceQuoteResult,
  QuoteBreakdown,
  SurchargeDetail,
} from "@/types/quote";

// ─── 입력 타입 ──────────────────────────────────────────

export interface RateConfigData {
  financeCompanyId: string;
  financeCompanyName: string;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minPriceRates: RateMatrix;       // {"10000":{"36":0.0123,...},...}
  maxPriceRates: RateMatrix;
  depositDiscountRate: number;      // 보증금 10%당 회수율 변동 (음수=할인)
  prepayAdjustRate: number;         // 선납금 10%당 회수율 변동
  financeSurchargeRate: number;     // 금융사 가산율 (%)
}

export interface CalcInput {
  vehiclePrice: number;
  contractMonths: number;          // 36 | 48 | 60
  annualMileage: number;           // 10000 | 20000 | 30000
  depositRate: number;             // 보증금 비율 (0, 10, 20, 30)
  prepayRate: number;              // 선납금 비율 (0, 10, 20, 30)
  vehicleSurchargeRate: number;    // 차량 가산율 (%)
  rankSurchargeRates: number[];    // [1순위%, 2순위%, 3순위%, 4순위+%]
  rateConfigs: RateConfigData[];   // 금융사별 회수율 데이터
}

// ─── 선형보간 ───────────────────────────────────────────

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  const t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  return y0 + t * (y1 - y0);
}

/** 차량가격 기준으로 회수율 선형보간 */
export function interpolateRate(
  vehiclePrice: number,
  minPrice: number,
  maxPrice: number,
  minRates: RateMatrix,
  maxRates: RateMatrix,
  mileageKey: string,
  monthsKey: string
): number {
  const minRate = minRates[mileageKey]?.[monthsKey] ?? 0;
  const maxRate = maxRates[mileageKey]?.[monthsKey] ?? 0;

  // 최대값이 0이면 최소값만 사용 (아직 미입력)
  if (maxRate === 0) return minRate;

  return lerp(vehiclePrice, minPrice, maxPrice, minRate, maxRate);
}

// ─── 단일 금융사 기준 대여료 계산 ─────────────────────────

function calcBaseMonthly(
  vehiclePrice: number,
  recoveryRate: number
): number {
  return Math.round(vehiclePrice * recoveryRate);
}

/** 보증금 적용 월 대여료 계산 */
function applyDeposit(
  vehiclePrice: number,
  baseRate: number,
  depositRate: number,   // 0, 10, 20, 30
  depositDiscountRate: number
): { monthly: number; depositAmount: number; discount: number } {
  const steps = depositRate / 10;  // 10% 단위수
  const depositAmount = Math.round(vehiclePrice * (depositRate / 100));

  // 보증금 적용 회수율 = 기준 회수율 + 할인회수율 × 단위수
  const adjustedRate = baseRate + depositDiscountRate * steps;
  const monthly = Math.round(vehiclePrice * adjustedRate);
  const discount = Math.round(vehiclePrice * Math.abs(depositDiscountRate) * steps);

  return { monthly, depositAmount, discount };
}

/** 선납금 적용 월 대여료 계산 */
function applyPrepay(
  vehiclePrice: number,
  baseMonthly: number,
  contractMonths: number,
  prepayRate: number,   // 0, 10, 20, 30
  prepayAdjustRate: number
): { monthly: number; prepayAmount: number; adjust: number } {
  const steps = prepayRate / 10;
  const prepayAmount = Math.round(vehiclePrice * (prepayRate / 100));

  // 선납금 로직: (기준대여료 - 선납금/개월수) + 차량가 × 선납금조정회수율 × 단위수
  const prepayDeduction = Math.round(prepayAmount / contractMonths);
  const adjustAmount = Math.round(vehiclePrice * prepayAdjustRate * steps);
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

  const mileageKey = String(annualMileage);
  const monthsKey = String(contractMonths);

  // 1) 각 금융사별 기본 대여료 계산
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
    // 회수율 선형보간
    const recoveryRate = interpolateRate(
      vehiclePrice,
      cfg.minVehiclePrice,
      cfg.maxVehiclePrice,
      cfg.minPriceRates,
      cfg.maxPriceRates,
      mileageKey,
      monthsKey
    );

    if (recoveryRate <= 0) continue;

    const baseMonthly = calcBaseMonthly(vehiclePrice, recoveryRate);
    let monthlyBeforeSurcharge: number;
    let depositAmount = 0;
    let prepayAmount = 0;
    let depositDiscount = 0;
    let prepayAdjust = 0;

    if (depositRate > 0) {
      // 보증금 적용 (보증금과 선납금은 동시 적용 안 함)
      const result = applyDeposit(vehiclePrice, recoveryRate, depositRate, cfg.depositDiscountRate);
      monthlyBeforeSurcharge = result.monthly;
      depositAmount = result.depositAmount;
      depositDiscount = result.discount;
    } else if (prepayRate > 0) {
      // 선납금 적용
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

  // 2) 기본 대여료 기준으로 1차 정렬 (순위 결정)
  intermediates.sort((a, b) => a.monthlyBeforeSurcharge - b.monthlyBeforeSurcharge);

  // 3) 순위 가산 + 차량 가산 + 금융사 가산 적용
  const results: FinanceQuoteResult[] = intermediates.map((item, idx) => {
    const rank = idx + 1;

    // 순위 가산 → 차량 가산 → 금융사 가산 순서로 누적 곱셈
    const rankRate = rank <= rankSurchargeRates.length
      ? rankSurchargeRates[rank - 1]
      : rankSurchargeRates[rankSurchargeRates.length - 1];

    const afterRank    = item.monthlyBeforeSurcharge * (1 + rankRate / 100);
    const afterVehicle = afterRank * (1 + vehicleSurchargeRate / 100);
    const monthlyPayment = Math.round(afterVehicle * (1 + item.config.financeSurchargeRate / 100));

    // breakdown 표시용 중간값 (반올림)
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
      rank, // 임시 (아래에서 재정렬)
      baseMonthly: item.monthlyBeforeSurcharge,
      monthlyPayment,
      breakdown,
      surcharges,
    };
  });

  // 4) 최종 가격 기준 재정렬 + 순위 재할당
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
  const mileageKey = String(annualMileage);
  const monthsKey = String(contractMonths);

  const rate = interpolateRate(
    vehiclePrice,
    rateConfig.minVehiclePrice,
    rateConfig.maxVehiclePrice,
    rateConfig.minPriceRates,
    rateConfig.maxPriceRates,
    mileageKey,
    monthsKey
  );

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
  conservative: ScenarioResult; // 보수형: 보증금 20%
  standard: ScenarioResult;     // 표준형: 보증금·선납금 0%
  aggressive: ScenarioResult;   // 공격형: 선납금 30%
}

export function calculateScenarios(
  vehiclePrice: number,
  rateConfig: RateConfigData,
  annualMileage: number = 20000,
  contractMonths: number = 48
): ScenarioResults {
  const mileageKey = String(annualMileage);
  const monthsKey = String(contractMonths);

  const rate = interpolateRate(
    vehiclePrice,
    rateConfig.minVehiclePrice,
    rateConfig.maxVehiclePrice,
    rateConfig.minPriceRates,
    rateConfig.maxPriceRates,
    mileageKey,
    monthsKey
  );

  const baseMonthly = Math.round(vehiclePrice * rate);

  // 보수형: 보증금 20%
  const conserv = applyDeposit(vehiclePrice, rate, 20, rateConfig.depositDiscountRate);
  // 표준형: 보증금·선납금 0%
  // 공격형: 선납금 30%
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
