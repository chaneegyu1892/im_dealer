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

export function isWithinRecommendationBudgetRange(
  monthlyPayment: number,
  budgetRange: RecommendBudgetRange
): boolean {
  const { budgetMin, budgetMax } = getRecommendationBudgetBounds(budgetRange);
  return (budgetMin <= 0 || monthlyPayment >= budgetMin)
    && (budgetMax <= 0 || monthlyPayment <= budgetMax);
}

export function compareRecommendationBudgetProximity(
  budgetRange: RecommendBudgetRange,
  leftMonthlyPayment: number,
  rightMonthlyPayment: number
): number {
  if (budgetRange.startsWith("lte-")) {
    return rightMonthlyPayment - leftMonthlyPayment;
  }
  if (budgetRange === "gte-1000k") {
    return leftMonthlyPayment - rightMonthlyPayment;
  }
  return 0;
}
