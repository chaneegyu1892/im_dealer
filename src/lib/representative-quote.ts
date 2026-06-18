/**
 * 대표 견적가 계산 — 차량 탐색 카드·홈 인기차량·차량 상세에서 공통으로 사용.
 *
 * 표시 기준: 60개월 / 무보증 / 연 2만km.
 * productType("장기렌트" | "리스")별로 calculateMultiFinanceQuote를 돌려
 * 가산(순위·차량·금융사) 포함 1순위 금액을 대표값으로 반환한다.
 * 두 productType이 모두 있으면 둘 다 반환(장기렌트 → 리스 순).
 *
 * 목록 페이지와 상세 페이지가 이 함수를 동일하게 사용해 견적가 불일치를 방지한다.
 */

import {
  calculateMultiFinanceQuote,
  type RateConfigData,
} from "./quote-calculator";
import type { RateSheetRaw } from "@/types/admin";

/** 대표 견적가 표시 조건: 60개월 / 무보증 / 연 2만km */
export const REPRESENTATIVE_CONDITION = {
  contractMonths: 60,
  annualMileage: 20000,
  depositRate: 0,
  prepayRate: 0,
} as const;

/** productType 표시 순서 — 장기렌트 먼저, 리스 다음 */
const PRODUCT_TYPE_ORDER = ["장기렌트", "리스"] as const;

export interface RepresentativeQuote {
  /** "장기렌트" | "리스" */
  productType: string;
  /** 가산 포함 1순위 월 납입금(원) */
  monthlyPayment: number;
  /** 1순위 금융사명 */
  financeCompanyName: string;
}

/** 단일 회수율 시트(계산에 필요한 필드만) */
export interface RepRateSheet {
  productType: string;
  financeCompanyId: string;
  financeCompanyName: string;
  financeSurchargeRate: number;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minRateMatrix: RateSheetRaw;
  maxRateMatrix: RateSheetRaw;
  depositDiscountRate: number;
  prepayAdjustRate: number;
}

interface CalcParams {
  vehiclePrice: number;
  vehicleSurchargeRate: number;
  rankSurchargeRates: number[];
  rateSheets: RepRateSheet[];
}

function productTypeOrder(productType: string): number {
  const idx = PRODUCT_TYPE_ORDER.indexOf(
    productType as (typeof PRODUCT_TYPE_ORDER)[number]
  );
  return idx === -1 ? PRODUCT_TYPE_ORDER.length : idx;
}

/**
 * productType별 대표 견적가 계산.
 * 견적 산출이 가능한 productType만 결과에 포함된다(시트가 없거나 회수율 0이면 제외).
 */
export function calcRepresentativeQuotes(params: CalcParams): RepresentativeQuote[] {
  const { vehiclePrice, vehicleSurchargeRate, rankSurchargeRates, rateSheets } = params;

  // productType별 그룹화 (불변 — 새 배열로 누적)
  const byType = new Map<string, RepRateSheet[]>();
  for (const sheet of rateSheets) {
    const existing = byType.get(sheet.productType) ?? [];
    byType.set(sheet.productType, [...existing, sheet]);
  }

  const quotes: RepresentativeQuote[] = [];
  for (const [productType, sheets] of byType) {
    const rateConfigs: RateConfigData[] = sheets.map((s) => ({
      financeCompanyId: s.financeCompanyId,
      financeCompanyName: s.financeCompanyName,
      financeSurchargeRate: s.financeSurchargeRate,
      minVehiclePrice: s.minVehiclePrice,
      maxVehiclePrice: s.maxVehiclePrice,
      minRateMatrix: s.minRateMatrix,
      maxRateMatrix: s.maxRateMatrix,
      depositDiscountRate: s.depositDiscountRate,
      prepayAdjustRate: s.prepayAdjustRate,
    }));

    const results = calculateMultiFinanceQuote({
      vehiclePrice,
      contractMonths: REPRESENTATIVE_CONDITION.contractMonths,
      annualMileage: REPRESENTATIVE_CONDITION.annualMileage,
      depositRate: REPRESENTATIVE_CONDITION.depositRate,
      prepayRate: REPRESENTATIVE_CONDITION.prepayRate,
      vehicleSurchargeRate,
      rankSurchargeRates,
      rateConfigs,
    });

    const best = results[0];
    if (best) {
      quotes.push({
        productType,
        monthlyPayment: best.monthlyPayment,
        financeCompanyName: best.financeCompanyName,
      });
    }
  }

  return quotes.sort(
    (a, b) => productTypeOrder(a.productType) - productTypeOrder(b.productType)
  );
}

/** 대표 견적가 목록에서 가장 낮은 월 납입금(정렬·요약용). 없으면 0. */
export function lowestMonthly(quotes: RepresentativeQuote[]): number {
  if (quotes.length === 0) return 0;
  return quotes.reduce(
    (min, q) => (q.monthlyPayment < min ? q.monthlyPayment : min),
    Infinity
  );
}
