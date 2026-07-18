import type { VehicleAttrs } from "./vehicle-attributes";
import {
  CARGO_RULES,
  CHILD_RULES,
  FAMILY_RULES,
  PREFERENCE_RULES,
  type RuleContext,
  type ScoreRule,
} from "./scoring-rules";
import type { ScoreCtx, ScoreInput } from "./scoring";
import type { OverlapScoreResult } from "./overlap-scoring";
import type { RecommendationCompatibility } from "./popularity-selector";

interface LegacyCompatibilityInput {
  readonly input: ScoreInput;
  readonly attrs: VehicleAttrs;
  readonly context: ScoreCtx;
}

function netMatchedPoints(
  rules: readonly ScoreRule[],
  attrs: VehicleAttrs,
  context: RuleContext
): number {
  return rules.reduce(
    (total, rule) => total + (rule.match(attrs, context) ? rule.pts : 0),
    0
  );
}

export function getLegacyRecommendationCompatibility({
  input,
  attrs,
  context,
}: LegacyCompatibilityInput): RecommendationCompatibility {
  const ruleContext: RuleContext = {
    category: context.category,
    price: context.price,
    fuelEfficiency: context.fuelEfficiency,
    annualMileage: input.annualMileage,
    detail: input.cargoDetail,
  };
  const selectedAxes: readonly (readonly ScoreRule[])[] = [
    ...(input.primaryPreference
      ? [PREFERENCE_RULES[input.primaryPreference] ?? []]
      : []),
    ...(input.situationPreference === "가족"
      ? [[...FAMILY_RULES, ...(input.childDetail
        ? CHILD_RULES[input.childDetail] ?? []
        : [])]]
      : []),
    ...(input.situationPreference === "화물" ? [CARGO_RULES] : []),
  ];

  return selectedAxes.every(
    (rules) => netMatchedPoints(rules, attrs, ruleContext) > 0
  )
    ? "compatible"
    : "conflict";
}

const compatibleLevels = new Set(["best", "fit", "support"]);

export function getOverlapRecommendationCompatibility(
  score: OverlapScoreResult
): RecommendationCompatibility {
  const selectedIntentContributions = score.contributions.filter(
    (contribution) =>
      (contribution.axis === "primaryPreference"
        || contribution.axis === "additionalCondition")
      && contribution.selectedValue !== null
  );
  return selectedIntentContributions.every((contribution) =>
    compatibleLevels.has(contribution.level)
  )
    ? "compatible"
    : "conflict";
}
