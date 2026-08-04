export const RECOMMEND_BUDGET_RANGE_IDS = [
  "lte-500k",
  "lte-800k",
  "lte-1000k",
  "gte-1000k",
  "auto",
] as const;

export type RecommendBudgetRange = (typeof RECOMMEND_BUDGET_RANGE_IDS)[number];

export const RECOMMEND_BUDGET_RANGE_OPTIONS = [
  { id: "lte-500k", label: "50만원 이하", desc: "월 부담을 가장 낮게 보고 싶어요" },
  { id: "lte-800k", label: "80만원 이하", desc: "실속 있는 선택지를 보고 싶어요" },
  { id: "lte-1000k", label: "100만원 이하", desc: "선택 폭과 월 부담을 함께 봐요" },
  // id 는 저장된 로그의 상하한 역매핑 식별자라 유지한다. 라벨만 실제 동작
  // (상한 해제 + 사양·등급 우선)에 맞춘다.
  { id: "gte-1000k", label: "예산 여유 있어요", desc: "가격보다 사양·등급 위주로 볼게요" },
  { id: "auto", label: "AI에게 맡길게요", desc: "조건에 맞는 예산대를 함께 찾아드려요" },
] as const satisfies ReadonlyArray<{
  readonly id: RecommendBudgetRange;
  readonly label: string;
  readonly desc: string;
}>;

export const RECOMMEND_BUDGET_RANGE_LABELS = Object.fromEntries(
  RECOMMEND_BUDGET_RANGE_OPTIONS.map((option) => [option.id, option.label])
) as Readonly<Record<RecommendBudgetRange, string>>;

export function isRecommendBudgetRange(value: unknown): value is RecommendBudgetRange {
  return RECOMMEND_BUDGET_RANGE_IDS.some((id) => id === value);
}
