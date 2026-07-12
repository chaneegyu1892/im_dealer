import type { OverlapContribution } from "./overlap-scoring";

const AXIS_ORDER: Record<OverlapContribution["axis"], number> = {
  industry: 0,
  primaryPreference: 1,
  additionalCondition: 2,
  annualMileage: 3,
  region: 4,
  chargingEnvironment: 5,
};

export const ZERO_POSITIVE_REASON = "선택한 조건을 기준으로 추천된 차량입니다.";

export function generateOverlapReason(
  contributions: readonly OverlapContribution[]
): string {
  const positive = contributions
    .filter((contribution) => contribution.weightedPoints > 0)
    .sort((left, right) => {
      if (left.weightedPoints !== right.weightedPoints) {
        return right.weightedPoints - left.weightedPoints;
      }
      return AXIS_ORDER[left.axis] - AXIS_ORDER[right.axis];
    })
    .slice(0, 3);

  if (positive.length === 0) return ZERO_POSITIVE_REASON;

  const labels = positive.map((contribution) =>
    contribution.selectedDetail
      ? `${contribution.selectedDetail} ${contribution.evidenceLabel}`
      : contribution.evidenceLabel
  );
  return `${labels.join(", ")} 조건을 반영한 추천입니다.`;
}
