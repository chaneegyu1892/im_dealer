import type { QuoteScenarioDetail } from "@/types/quote";
import type { RecommendScenario } from "@/types/recommendation";

/**
 * 회원 전용 게이트 — 서버단 보안 경계.
 *
 * 보증금/선납금으로 낮아진 월납입금은 회원만 볼 수 있다. 비회원에게는
 * "블러로 가리는" 게 아니라 응답 JSON 에 금액을 **애초에 담지 않는다**.
 * 아래 함수들은 민감한 금액·산출내역을 모두 제거한 잠금 시나리오를 새로 만들어
 * 돌려준다(원본은 변형하지 않음 — immutable).
 *
 * 유지하는 값: 계약기간/약정거리/계약유형 — 레이아웃 표시용 비민감 정보.
 * 제거하는 값: 월납입금, 보증금/선납금, 금융사별 결과, 산출내역 등 전부 0/빈값.
 */

/** 견적 화면용 시나리오(QuoteScenarioDetail)를 비회원용 잠금 상태로 치환. */
export function lockQuoteScenario(base: QuoteScenarioDetail): QuoteScenarioDetail {
  return {
    monthlyPayment: 0,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: base.contractMonths,
    annualMileage: base.annualMileage,
    contractType: base.contractType,
    bestFinanceCompany: "",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
    rangeExceeded: false,
    locked: true,
  };
}

/** 추천 카드용 시나리오(RecommendScenario)를 비회원용 잠금 상태로 치환. */
export function lockRecommendScenario(base: RecommendScenario): RecommendScenario {
  return {
    monthlyPayment: 0,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: base.contractMonths,
    annualMileage: base.annualMileage,
    contractType: base.contractType,
    locked: true,
  };
}
