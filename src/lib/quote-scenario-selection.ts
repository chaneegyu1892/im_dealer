import { PUBLIC_RESULT_INITIAL_COST } from "@/constants/quote-defaults";
import { isPublicQuoteResultRates } from "@/lib/member-gate";
import type {
  QuoteScenarioDetail,
  QuoteScenarioDetails,
  QuoteScenarioType,
} from "@/types/quote";

export type QuoteInitialRates = {
  readonly depositRate: number;
  readonly prepayRate: number;
};

export const DEFAULT_RESULT_CUSTOM_RATES: QuoteInitialRates = {
  depositRate: PUBLIC_RESULT_INITIAL_COST.depositRate,
  prepayRate: PUBLIC_RESULT_INITIAL_COST.prepayRate,
};

export const DEFAULT_RESULT_COST_MODE = "initial" as const;

/** 실제 월납입금을 가진, 화면에 가격으로 그려도 되는 시나리오. */
export type DisplayableQuoteScenario = QuoteScenarioDetail & { monthlyPayment: number };

/**
 * 화면에 가격으로 그려도 되는 시나리오인지 판별한다.
 * 잠금(locked)이거나 월납입금이 없는(null/absent) 시나리오는 가격이 아니다.
 * 롤아웃 과도기의 구형 잠금 응답(locked + monthlyPayment 0)과 0 이하 금액도
 * "0만원"으로 그려지면 안 되므로 표시 불가로 본다.
 */
export function isDisplayableQuoteScenario(
  scenario: QuoteScenarioDetail | undefined,
): scenario is DisplayableQuoteScenario {
  return (
    scenario != null &&
    scenario.locked !== true &&
    scenario.monthlyPayment != null &&
    scenario.monthlyPayment > 0
  );
}

/**
 * 견적 결과 첫 페인트는 aggressive(선납 30%). 이후 재계산은 standard 슬롯.
 * 잠긴/가격 없는 시나리오는 절대 반환하지 않는다 — 표시 가능한 공개 시나리오가
 * 없으면 undefined 를 돌려주고, 호출부가 로그인 안내 등 비가격 상태를 그린다.
 */
export function resolveQuoteResultScenario(
  scenarios: QuoteScenarioDetails | undefined,
  rates: QuoteInitialRates,
): QuoteScenarioDetail | undefined {
  if (!scenarios) return undefined;
  const standard = scenarios.standard;
  const aggressive = scenarios.aggressive;
  if (isPublicQuoteResultRates(rates)) {
    if (isDisplayableQuoteScenario(standard) && standard.prepayAmount > 0) {
      return standard;
    }
    return isDisplayableQuoteScenario(aggressive) ? aggressive : undefined;
  }
  if (isDisplayableQuoteScenario(standard)) return standard;
  // standard 가 잠긴 비회원 세션(비공개 비율 복원 등)은 공개 선납 30% 로 폴백한다.
  return isDisplayableQuoteScenario(aggressive) ? aggressive : undefined;
}

export function deriveQuoteScenarioType(rates: QuoteInitialRates): QuoteScenarioType {
  if (rates.depositRate > 0) return "conservative";
  if (rates.prepayRate > 0) return "aggressive";
  return "standard";
}

export function parseQuoteScenarioType(value: unknown): QuoteScenarioType | undefined {
  if (value === "conservative" || value === "standard" || value === "aggressive") {
    return value;
  }
  return undefined;
}

export function realignSelectedQuoteScenarios(
  scenarios: QuoteScenarioDetails,
  scenarioType: QuoteScenarioType,
  baseStandard: QuoteScenarioDetail
): QuoteScenarioDetails {
  switch (scenarioType) {
    case "conservative":
    case "aggressive":
      return {
        ...scenarios,
        [scenarioType]: scenarios.standard,
        standard: baseStandard,
      };
    case "standard":
      return scenarios;
    default: {
      const exhaustiveScenarioType: never = scenarioType;
      return exhaustiveScenarioType;
    }
  }
}
