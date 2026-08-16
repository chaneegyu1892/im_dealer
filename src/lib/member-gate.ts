import { PUBLIC_RESULT_INITIAL_COST } from "@/constants/quote-defaults";
import type { QuoteScenarioDetail } from "@/types/quote";
import type { RecommendScenario } from "@/types/recommendation";

type QuoteScenarioMap = {
  conservative: QuoteScenarioDetail;
  standard: QuoteScenarioDetail;
  aggressive: QuoteScenarioDetail;
};

/**
 * 회원 전용 게이트 — 서버단 보안 경계.
 *
 * 견적 결과(step 3)에서 비회원에게 금액을 남기는 공개 조건은
 * 선납 30%(deposit 0 / prepay 30, aggressive)뿐이다. 무보증(standard)과
 * 보증금(conservative) 금액은 회원만 볼 수 있다. 기간·약정거리는 잠그지 않는다.
 *
 * 비회원에게는 "블러로 가리는" 게 아니라 응답 JSON 에 잠긴 시나리오 금액을
 * **애초에 담지 않는다**. 아래 함수들은 민감한 금액·산출내역을 모두 제거한
 * 잠금 시나리오를 새로 만들어 돌려준다(원본은 변형하지 않음 — immutable).
 *
 * 유지하는 값: 계약기간/약정거리/계약유형 — 레이아웃 표시용 비민감 정보.
 * 제거하는 값: 월납입금(null — 잠금은 "가격 없음"이지 0원이 아니다),
 * 보증금/선납금, 금융사별 결과, 산출내역 등 전부 빈값.
 *
 * 홈/카드 대표가(PUBLIC_CARD_QUOTE_CONDITION, 60개월·연 2만km·무보증)와
 * 추천 카드 잠금은 이 정책과 별개다.
 */

export const PUBLIC_QUOTE_RESULT_RATES = PUBLIC_RESULT_INITIAL_COST;

export function isPublicQuoteResultRates(rates: {
  readonly depositRate?: number | null;
  readonly prepayRate?: number | null;
}): boolean {
  return (
    (rates.depositRate ?? 0) === PUBLIC_QUOTE_RESULT_RATES.depositRate &&
    (rates.prepayRate ?? 0) === PUBLIC_QUOTE_RESULT_RATES.prepayRate
  );
}

/** 견적 화면용 시나리오(QuoteScenarioDetail)를 비회원용 잠금 상태로 치환. */
export function lockQuoteScenario(base: QuoteScenarioDetail): QuoteScenarioDetail {
  return {
    monthlyPayment: null,
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

/**
 * 견적 결과 3시나리오를 비회원용으로 잠근다.
 * aggressive(선납 30%)는 공개. standard·conservative 는 잠근다.
 * 커스텀 재계산이 공개 조건(0/30)이면 standard 슬롯 금액은 그대로 둔다.
 */
export function gateQuoteScenariosForGuest<T extends QuoteScenarioMap>(
  scenarios: T,
  options?: { readonly keepStandardUnlocked?: boolean },
): T {
  return {
    ...scenarios,
    conservative: lockQuoteScenario(scenarios.conservative),
    standard: options?.keepStandardUnlocked
      ? scenarios.standard
      : lockQuoteScenario(scenarios.standard),
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
