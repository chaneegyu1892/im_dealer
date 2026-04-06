// 견적 계산 기본값

export const QUOTE_DEFAULTS = {
  contractMonths: [36, 48, 60] as const,
  annualMileages: [10000, 20000, 30000] as const,
  depositOptions: [0, 10, 20, 30] as const,   // 보증금 비율(%)
  prepayOptions: [0, 10, 20, 30] as const,     // 선납금 비율(%)
} as const;

/** 순위 가산율 — 1순위: 1%, 2순위: 1.5%, 3순위: 2%, 4순위+: 2.5% */
export const RANK_SURCHARGE_RATES = [1.0, 1.5, 2.0, 2.5] as const;

export const PRODUCT_TYPES = {
  RENT: "렌트",
  LEASE: "리스",
} as const;

export const CONTRACT_TYPES = {
  RETURN: "반납형",
  PURCHASE: "인수형",
} as const;

export const PAYMENT_STYLES = {
  CONSERVATIVE: "보수형",
  STANDARD: "표준형",
  AGGRESSIVE: "공격형",
} as const;
