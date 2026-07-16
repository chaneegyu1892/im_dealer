// ─── 회수율 기반 견적 시스템 ────────────────────────────

/** 회수율 매트릭스: 주행거리(km) → 계약기간(월) → 회수율 */
export type RateMatrix = Record<string, Record<string, number>>;

/** 개별 금융사 견적 결과 */
export interface FinanceQuoteResult {
  financeCompanyId: string;
  financeCompanyName: string;
  rank: number;                  // 가산 후 최종 순위
  baseMonthly: number;           // 기본 대여료 (가산 전)
  monthlyPayment: number;        // 최종 월 대여료 (가산 후)
  breakdown: QuoteBreakdown;
  surcharges: SurchargeDetail;
  /** 차량가가 회수율 시트 범위(min~max)를 벗어났는지 여부.
   * true 면 클램프된 값으로 계산됨 — 어드민에게 회수율 데이터 보강 권고. */
  rangeExceeded: boolean;
}

/** 비용 항목 상세 */
export interface QuoteBreakdown {
  vehiclePrice: number;          // 차량가격
  recoveryRate: number;          // 적용된 회수율
  baseMonthly: number;           // 기준 대여료 (보증금·선납금 전)
  depositAmount: number;         // 보증금 (원)
  prepayAmount: number;          // 선납금 (원)
  depositDiscount: number;       // 보증금 할인액 (월)
  prepayAdjust: number;          // 선납금 공제 + 조정액 (월)
  monthlyBeforeSurcharge: number; // 가산 전 월 대여료
}

/** 가산 내역 */
export interface SurchargeDetail {
  rankSurcharge: number;         // 순위 가산액 (월)
  vehicleSurcharge: number;      // 차량 가산액 (월)
  financeSurcharge: number;      // 금융사 가산액 (월)
  totalSurcharge: number;        // 가산 합계 (월)
}

/** 견적 요청 입력 */
export interface QuoteInput {
  vehiclePrice: number;          // 차량가격 (원)
  contractMonths: number;        // 계약기간 (36|48|60)
  annualMileage: number;         // 약정거리 (10000|20000|30000)
  depositRate: number;           // 보증금 비율 (0~30, 10단위)
  prepayRate: number;            // 선납금 비율 (0~30, 10단위)
  productType: string;           // 렌트 | 리스
}

/** 다중 금융사 견적 결과 (고객 표시용) */
export interface MultiFinanceQuoteResult {
  input: QuoteInput;
  quotes: FinanceQuoteResult[];  // 최종 순위 정렬됨
  bestQuote: FinanceQuoteResult; // 1순위
}

/** 시나리오별 견적 (무보증/보증금/선납금) */
export interface QuoteScenarios {
  conservative: FinanceQuoteResult; // 보증금: 보증금 있음
  standard: FinanceQuoteResult;     // 무보증: 보증금·선납금 없음
  aggressive: FinanceQuoteResult;   // 선납금: 선납금 있음
}

/** 금융사별 견적 요약 (비교 테이블용) */
export interface FinanceCompanyQuote {
  financeCompanyName: string;
  rank: number;
  monthlyPayment: number;
  baseMonthly: number;
  surcharges: SurchargeDetail;
}

/** 견적 계산기 전용 시나리오 상세 (breakdown + surcharges 포함) */
export interface QuoteScenarioDetail {
  monthlyPayment: number;
  depositAmount: number;
  prepayAmount: number;
  contractMonths: number;
  annualMileage: number;
  contractType: string;
  bestFinanceCompany: string;
  purchaseSurcharge: number;       // 인수형 가산액 (반납형이면 0)
  breakdown: QuoteBreakdown | null;
  surcharges: SurchargeDetail | null;
  allFinanceResults: FinanceCompanyQuote[];
  /** 차량가가 회수율 시트 범위(min~max)를 벗어났는지 여부 (1순위 금융사 기준).
   * true 면 클램프된 값으로 계산되어 정확도가 떨어질 수 있다. */
  rangeExceeded?: boolean;
  /** 회원 전용 시나리오를 비회원에게 잠근 상태. true 면 금액 필드는 0(빈값)이며
   * 실제 값은 서버 응답에 포함되지 않는다(보안 경계). */
  locked?: boolean;
}

export interface QuoteScenarioDetails {
  conservative: QuoteScenarioDetail;
  standard: QuoteScenarioDetail;
  aggressive: QuoteScenarioDetail;
}

export type QuoteScenarioType = keyof QuoteScenarioDetails;

export type ContractType = "인수형" | "반납형";
export type ProductType = "렌트" | "리스";
