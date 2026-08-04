import type { RecommendBudgetRange } from "@/constants/recommend-budget";

export interface RecommendationBudgetBounds {
  readonly budgetMin: number;
  readonly budgetMax: number;
}

const BOUNDS_BY_RANGE: Readonly<Record<RecommendBudgetRange, RecommendationBudgetBounds>> = {
  "lte-500k": { budgetMin: 0, budgetMax: 500_000 },
  "lte-800k": { budgetMin: 0, budgetMax: 800_000 },
  "lte-1000k": { budgetMin: 0, budgetMax: 1_000_000 },
  "gte-1000k": { budgetMin: 1_000_000, budgetMax: 0 },
  auto: { budgetMin: 0, budgetMax: 0 },
};

export function getRecommendationBudgetBounds(
  budgetRange: RecommendBudgetRange
): RecommendationBudgetBounds {
  return BOUNDS_BY_RANGE[budgetRange];
}

export function getRecommendationBudgetRange(
  budgetMin: number,
  budgetMax: number
): RecommendBudgetRange | undefined {
  return (Object.entries(BOUNDS_BY_RANGE) as Array<[
    RecommendBudgetRange,
    RecommendationBudgetBounds,
  ]>).find(([, bounds]) =>
    bounds.budgetMin === budgetMin && bounds.budgetMax === budgetMax
  )?.[0];
}

export function isWithinRecommendationBudget(
  monthlyPayment: number,
  budgetMax: number | undefined
): boolean {
  return budgetMax === undefined || budgetMax <= 0 || monthlyPayment <= budgetMax;
}

/**
 * "예산 여유 있어요"(gte-1000k)는 하한이 아니라 상한 해제다. 월납입금으로
 * 후보를 거르지 않는다 — 인기순위 풀 최고가가 100만원에 못 미쳐 하한을 적용하면
 * 결과가 영구히 0건이 된다. budgetMin 은 저장된 로그를 예산대로 되돌리는
 * 식별값(getRecommendationBudgetRange)으로만 남긴다.
 */
export function isWithinRecommendationBudgetRange(
  monthlyPayment: number,
  budgetRange: RecommendBudgetRange
): boolean {
  const { budgetMax } = getRecommendationBudgetBounds(budgetRange);
  return budgetMax <= 0 || monthlyPayment <= budgetMax;
}

/**
 * 상한이 있는 예산대에서 상한을 넘어선 금액. 근접 후보("조금만 더 쓰면 가능한
 * 차량") 안내에 쓴다. 상한 안이거나 상한이 없으면 null.
 */
export function getRecommendationBudgetOvershoot(
  budgetRange: RecommendBudgetRange,
  monthlyPayment: number
): number | null {
  const { budgetMax } = getRecommendationBudgetBounds(budgetRange);
  if (budgetMax <= 0) return null;
  const overshoot = monthlyPayment - budgetMax;
  return overshoot > 0 ? overshoot : null;
}

/**
 * 이하 모드는 상한에 가장 가까운(비싼) 차를, 여유 모드는 사양·등급이 높은
 * (비싼) 차를 앞세운다. 여유 모드에서 하한만 없애고 이 정렬을 두고 가면
 * 가장 싼 차가 먼저 나온다.
 */
export function compareRecommendationBudgetProximity(
  budgetRange: RecommendBudgetRange,
  leftMonthlyPayment: number,
  rightMonthlyPayment: number
): number {
  if (budgetRange.startsWith("lte-") || budgetRange === "gte-1000k") {
    return rightMonthlyPayment - leftMonthlyPayment;
  }
  return 0;
}
