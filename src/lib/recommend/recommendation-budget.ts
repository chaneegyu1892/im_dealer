export function isWithinRecommendationBudget(
  monthlyPayment: number,
  budgetMax: number | undefined
): boolean {
  return budgetMax === undefined || budgetMax <= 0 || monthlyPayment <= budgetMax;
}
