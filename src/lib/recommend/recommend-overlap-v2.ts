import type {
  RecommendInput,
  OverlapRecommendedVehicle,
} from "@/types/recommendation";
import { getRecommendationModelKey } from "./latest-model";
import {
  loadOverlapCandidateSnapshot,
  type OverlapCandidateSnapshot,
  type OverlapRuntimeVehicle,
} from "./overlap-candidate-loader";
import {
  assessOperationalEligibility,
  type EligibleOperationalResult,
  type OperationalEligibilityStatus,
} from "./operational-eligibility";
import { rankOverlapCandidates, type RankableOverlapCandidate } from "./overlap-ranking";
import { parseOverlapRuntimeInput } from "./overlap-runtime-input";
import { scoreOverlapVehicle, type OverlapScoringInput } from "./overlap-scoring";
import { generateOverlapReason } from "./reason";
import {
  buildRecommendScenarios,
  buildStandardRecommendScenario,
} from "./recommend-scenarios";
import { isWithinRecommendationBudget } from "./recommendation-budget";
import { getPopularityEvidence } from "./popularity-snapshot";
import { getOverlapRecommendationCompatibility } from "./recommend-compatibility";
import {
  DEFAULT_PUBLIC_QUOTE_PRODUCT_TYPE,
  PUBLIC_CARD_QUOTE_CONDITION,
} from "@/constants/quote-defaults";

interface RuntimeScoredCandidate extends RankableOverlapCandidate {
  readonly vehicle: OverlapRuntimeVehicle;
  readonly eligibility: EligibleOperationalResult;
  readonly standardMonthlyPayment: number;
}

export interface OverlapEligibilityDiagnostic {
  readonly slug: string;
  readonly status: OperationalEligibilityStatus;
}

export interface OverlapRecommendationRun {
  readonly vehicles: readonly OverlapRecommendedVehicle[];
  readonly diagnostics: readonly OverlapEligibilityDiagnostic[];
}

function scoreEligibleVehicles(
  input: OverlapScoringInput,
  snapshot: OverlapCandidateSnapshot
): { readonly candidates: readonly RuntimeScoredCandidate[]; readonly diagnostics: readonly OverlapEligibilityDiagnostic[] } {
  const candidates: RuntimeScoredCandidate[] = [];
  const diagnostics: OverlapEligibilityDiagnostic[] = [];
  for (const vehicle of snapshot.vehicles) {
    const eligibility = assessOperationalEligibility(
      vehicle,
      PUBLIC_CARD_QUOTE_CONDITION.annualMileage,
    );
    diagnostics.push({ slug: vehicle.slug, status: eligibility.status });
    if (eligibility.status !== "eligible") continue;
    const effectiveTrimPrice = eligibility.selectedTrim.discountPrice
      ?? eligibility.selectedTrim.price;
    const score = scoreOverlapVehicle(input, eligibility.profile);
    candidates.push({
      vehicleId: vehicle.vehicleId,
      slug: vehicle.slug,
      modelKey: getRecommendationModelKey({
        brand: vehicle.brand,
        name: vehicle.name,
        defaultTrimName: eligibility.selectedTrim.name,
        lineupName: eligibility.selectedTrim.lineup?.name,
      }),
      modelYear: eligibility.modelYear,
      profile: eligibility.profile,
      score,
      fitScore: score.rankScore,
      compatibility: getOverlapRecommendationCompatibility(score),
      popularity: getPopularityEvidence(vehicle.slug),
      vehicle,
      eligibility,
      standardMonthlyPayment: buildStandardRecommendScenario({
        vehiclePrice: effectiveTrimPrice,
        vehicleSurchargeRate: vehicle.surchargeRate,
        rankSurchargeRates: snapshot.rankSurchargeRates,
        rateConfigs: eligibility.rateConfigs,
        estimatedMonthly: eligibility.estimatedMonthly,
      }).monthlyPayment,
    });
  }
  return { candidates, diagnostics };
}

function toRecommendedVehicle(
  candidate: RuntimeScoredCandidate,
  rankSurchargeRates: readonly number[],
  rank: number
): OverlapRecommendedVehicle {
  const { vehicle, eligibility, profile, score } = candidate;
  const trim = eligibility.selectedTrim;
  const effectiveTrimPrice = trim.discountPrice ?? trim.price;
  const scenarios = buildRecommendScenarios({
    vehiclePrice: effectiveTrimPrice,
    vehicleSurchargeRate: vehicle.surchargeRate,
    rankSurchargeRates,
    rateConfigs: eligibility.rateConfigs,
    estimatedMonthly: eligibility.estimatedMonthly,
  });
  return {
    vehicleId: vehicle.vehicleId,
    rank,
    score: score.rankScore,
    scoringVersion: "overlap-v2",
    documentScore: score.documentScore,
    chargingAdjustment: score.chargingAdjustment,
    rankScore: score.rankScore,
    contributions: score.contributions,
    tieBreak: {
      modelYear: candidate.modelYear,
      companyPriority: profile.companyPriority,
      profitPriority: profile.profitPriority,
      slug: vehicle.slug,
    },
    reason: generateOverlapReason(score.contributions),
    highlights: [...vehicle.highlights].slice(0, 4),
    estimatedMonthly: scenarios.standard.monthlyPayment,
    vehicle: {
      name: vehicle.name,
      brand: vehicle.brand,
      category: vehicle.category,
      thumbnailUrl: vehicle.thumbnailUrl,
      imageUrls: [...vehicle.imageUrls],
      defaultTrimName: trim.name,
      defaultTrimPrice: trim.price,
      recommendedTrimId: trim.id,
      effectiveTrimPrice,
      productType: DEFAULT_PUBLIC_QUOTE_PRODUCT_TYPE,
      slug: vehicle.slug,
      popularConfigs: vehicle.popularConfigs.map((config) => ({
        id: config.id,
        name: config.name,
        note: config.note,
        items: config.items.map((item) => ({ ...item })),
      })),
    },
    scenarios,
    popularity: candidate.popularity,
  };
}

export function recommendOverlapV2FromSnapshot(
  rawInput: unknown,
  snapshot: OverlapCandidateSnapshot
): OverlapRecommendationRun {
  const input = parseOverlapRuntimeInput(rawInput);
  const scored = scoreEligibleVehicles(input, snapshot);
  const withinBudget = scored.candidates.filter((candidate) =>
    isWithinRecommendationBudget(
      candidate.standardMonthlyPayment,
      input.budgetMax
    )
  );
  const ranked = rankOverlapCandidates(withinBudget, input.fuelPreference);
  return {
    vehicles: ranked.map((candidate, index) =>
      toRecommendedVehicle(candidate, snapshot.rankSurchargeRates, index + 1)
    ),
    diagnostics: scored.diagnostics,
  };
}

export async function recommendOverlapV2(input: RecommendInput): Promise<OverlapRecommendedVehicle[]> {
  const snapshot = await loadOverlapCandidateSnapshot();
  return [...recommendOverlapV2FromSnapshot(input, snapshot).vehicles];
}
