// 견적 계산 기본값

export const QUOTE_DEFAULTS = {
  contractMonths: [36, 48, 60] as const,
  annualMileages: [10000, 20000, 30000] as const,
  depositOptions: [0, 10, 20, 30] as const,   // 보증금 비율(%)
  prepayOptions: [0, 10, 20, 30] as const,     // 선납금 비율(%)
} as const;

/** 순위 가산율 — 1순위: 1%, 2순위: 1.5%, 3순위: 2%, 4순위+: 2.5% */
export const RANK_SURCHARGE_RATES = [1.0, 1.5, 2.0, 2.5] as const;

/** 고객용 차량 카드·추천 결과에서 공통으로 사용하는 대표 견적 조건. */
export const PUBLIC_CARD_QUOTE_CONDITION = {
  contractMonths: 60,
  annualMileage: 20_000,
  depositRate: 0,
  prepayRate: 0,
  contractType: "반납형",
} as const;

/** 추천 카드의 단일 대표 금액은 견적 페이지 기본 상품과 동일하게 장기렌트로 계산한다. */
export const DEFAULT_PUBLIC_QUOTE_PRODUCT_TYPE = "장기렌트" as const;

export const PRODUCT_TYPES = {
  RENT: "렌트",
  LEASE: "리스",
} as const;

export const CONTRACT_TYPES = {
  RETURN: "반납형",
  PURCHASE: "인수형",
} as const;
