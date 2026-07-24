import {
  STEP02_V3_STYLE_LABELS,
  type Step02V3Style,
} from "@/constants/recommend-step02-v3";
import {
  DEFAULT_PUBLIC_QUOTE_PRODUCT_TYPE,
} from "@/constants/quote-defaults";
import type {
  RecommendInput,
  Step02V3RecommendedVehicle,
} from "@/types/recommendation";
import type { RecommendBudgetRange } from "@/constants/recommend-budget";
import { getRecommendationModelKey } from "./latest-model";
import {
  loadOverlapCandidateSnapshot,
  type OverlapCandidateSnapshot,
  type OverlapRuntimeVehicle,
} from "./overlap-candidate-loader";
import {
  assessStep02V3OperationalEligibility,
  type OperationalEligibilityStatus,
  type Step02V3EligibleOperationalResult,
} from "./operational-eligibility";
import { parseOverlapRuntimeInput } from "./overlap-runtime-input";
import { scoreOverlapVehicle } from "./overlap-scoring";
import { buildRecommendScenarios, buildStandardRecommendScenario } from "./recommend-scenarios";
import {
  compareRecommendationBudgetProximity,
  isWithinRecommendationBudgetRange,
} from "./recommendation-budget";
import { getPopularityEvidence } from "./popularity-snapshot";
import {
  mixNearbyPopularityCandidates,
  type RecommendationSelectionOptions,
} from "./popularity-selector";
import {
  STEP02_V3_CATALOG_NAMES,
  STEP02_V3_POINTS,
  getStep02V3FollowupBonus,
  getStep02V3StyleLevel,
} from "./step02-v3-data";
import { getRecommendFuelGroup, type RecommendFuelGroup } from "./vehicle-attributes";
import { generateStep02V3Reason } from "@/lib/llm-reason";

interface Step02V3RuntimeCandidate {
  readonly vehicleId: string;
  readonly slug: string;
  readonly modelKey: string;
  readonly modelYear: number;
  readonly vehicle: OverlapRuntimeVehicle;
  readonly eligibility: Step02V3EligibleOperationalResult;
  readonly stylePreference: Step02V3Style;
  readonly styleScore: number;
  readonly followupBonus: number;
  readonly autoConditionScore: number;
  readonly rankScore: number;
  readonly popularity: ReturnType<typeof getPopularityEvidence>;
  readonly companyPriority: number;
  readonly profitPriority: number;
  readonly immediateDeliveryAvailable: boolean;
  readonly availableStockCount: number;
  readonly standardMonthlyPayment: number;
}

export interface Step02V3EligibilityDiagnostic {
  readonly slug: string;
  readonly status: OperationalEligibilityStatus | "not_in_document" | "not_in_popularity_top_30" | "style_mismatch" | "fuel_mismatch" | "outside_budget_range";
}

export interface Step02V3RecommendationRun {
  readonly vehicles: readonly Step02V3RecommendedVehicle[];
  readonly diagnostics: readonly Step02V3EligibilityDiagnostic[];
}

function inferFuelGroup(
  vehicleName: string,
  engineType: string | undefined,
  profileFuelGroup: "EV" | "HEV" | "ICE" | undefined
): RecommendFuelGroup {
  if (profileFuelGroup) return profileFuelGroup;
  if (/HEV|하이브리드/i.test(vehicleName)) return "HEV";
  if (
    /(?:\bEV\d*\b|\sEV$|EVX|일렉트릭|아이오닉|Electrified|넥쏘|GV60)/i.test(vehicleName)
  ) return "EV";
  return getRecommendFuelGroup(engineType ?? "");
}

function requiredFuelGroup(fuelPreference: string | undefined): RecommendFuelGroup | null {
  if (fuelPreference === "전기차") return "EV";
  if (fuelPreference === "하이브리드") return "HEV";
  if (fuelPreference === "가솔린/디젤") return "ICE";
  return null;
}

function autoConditionScore(
  input: RecommendInput,
  eligibility: Step02V3EligibleOperationalResult
): number {
  if (!eligibility.profile) return 0;
  const parsed = parseOverlapRuntimeInput({
    ...input,
    primaryPreference: undefined,
    situationPreference: undefined,
    childDetail: undefined,
    cargoDetail: undefined,
  });
  return scoreOverlapVehicle(parsed, eligibility.profile).rankScore;
}

function compareTieBreak(
  left: Step02V3RuntimeCandidate,
  right: Step02V3RuntimeCandidate
): number {
  if (left.modelYear !== right.modelYear) return right.modelYear - left.modelYear;
  if (left.companyPriority !== right.companyPriority) {
    return right.companyPriority - left.companyPriority;
  }
  if (left.immediateDeliveryAvailable !== right.immediateDeliveryAvailable) {
    return left.immediateDeliveryAvailable ? -1 : 1;
  }
  if (left.availableStockCount !== right.availableStockCount) {
    return right.availableStockCount - left.availableStockCount;
  }
  if (left.profitPriority !== right.profitPriority) {
    return right.profitPriority - left.profitPriority;
  }
  return left.slug.localeCompare(right.slug);
}

export function compareStep02V3Candidates(
  left: Step02V3RuntimeCandidate,
  right: Step02V3RuntimeCandidate
): number {
  if (left.rankScore !== right.rankScore) return right.rankScore - left.rankScore;
  const leftRank = left.popularity.rank;
  const rightRank = right.popularity.rank;
  if (leftRank !== null && rightRank !== null && leftRank !== rightRank) {
    return leftRank - rightRank;
  }
  return compareTieBreak(left, right);
}

function buildReason(candidate: Step02V3RuntimeCandidate): string {
  if (candidate.stylePreference === "auto") {
    if (candidate.followupBonus > 0) {
      return "선택한 추가 조건과 인기·운행 조건을 함께 반영한 추천입니다.";
    }
    return "등록 형태와 주행 조건, 인기·공급 기준을 함께 반영한 추천입니다.";
  }
  const styleLabel = STEP02_V3_STYLE_LABELS[candidate.stylePreference];
  if (candidate.followupBonus > 0) {
    return `${styleLabel} 적합도와 선택한 추가 조건을 함께 반영한 추천입니다.`;
  }
  return `${styleLabel} 기준에 잘 맞는 차량입니다.`;
}

function toRecommendedVehicle(
  candidate: Step02V3RuntimeCandidate,
  rankSurchargeRates: readonly number[],
  rank: number
): Step02V3RecommendedVehicle {
  const { vehicle, eligibility } = candidate;
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
    score: candidate.rankScore,
    scoringVersion: "step02-v3",
    stylePreference: candidate.stylePreference,
    styleScore: candidate.styleScore,
    followupBonus: candidate.followupBonus,
    autoConditionScore: candidate.autoConditionScore,
    rankScore: candidate.rankScore,
    tieBreak: {
      modelYear: candidate.modelYear,
      companyPriority: candidate.companyPriority,
      immediateDeliveryAvailable: candidate.immediateDeliveryAvailable,
      availableStockCount: candidate.availableStockCount,
      profitPriority: candidate.profitPriority,
      slug: vehicle.slug,
    },
    reason: buildReason(candidate),
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

function deduplicateModels(
  candidates: readonly Step02V3RuntimeCandidate[],
  budgetRange: RecommendBudgetRange
): Step02V3RuntimeCandidate[] {
  const sorted = [...candidates].sort((left, right) => {
    const budgetOrder = compareRecommendationBudgetProximity(
      budgetRange,
      left.standardMonthlyPayment,
      right.standardMonthlyPayment
    );
    return budgetOrder !== 0 ? budgetOrder : compareStep02V3Candidates(left, right);
  });
  const modelKeys = new Set<string>();
  return sorted.filter((candidate) => {
    if (modelKeys.has(candidate.modelKey)) return false;
    modelKeys.add(candidate.modelKey);
    return true;
  });
}

export function recommendStep02V3FromSnapshot(
  input: RecommendInput,
  snapshot: OverlapCandidateSnapshot,
  selectionOptions: RecommendationSelectionOptions = {}
): Step02V3RecommendationRun {
  if (
    input.recommendationVersion !== "step02-v3"
    || !input.stylePreference
    || !input.budgetRange
  ) {
    throw new RangeError("step02-v3 추천 입력이 아닙니다.");
  }
  const requiredFuel = requiredFuelGroup(input.fuelPreference);
  const diagnostics: Step02V3EligibilityDiagnostic[] = [];
  const candidates: Step02V3RuntimeCandidate[] = [];

  for (const vehicle of snapshot.vehicles) {
    if (!STEP02_V3_CATALOG_NAMES.has(vehicle.name)) {
      diagnostics.push({ slug: vehicle.slug, status: "not_in_document" });
      continue;
    }
    const popularity = getPopularityEvidence(vehicle.slug);
    if (popularity.rank === null) {
      diagnostics.push({ slug: vehicle.slug, status: "not_in_popularity_top_30" });
      continue;
    }
    const styleLevel = getStep02V3StyleLevel(input.stylePreference, vehicle.name);
    if (input.stylePreference !== "auto" && styleLevel === "none") {
      diagnostics.push({ slug: vehicle.slug, status: "style_mismatch" });
      continue;
    }
    const eligibility = assessStep02V3OperationalEligibility(
      vehicle,
      input.annualMileage as 10_000 | 20_000 | 30_000
    );
    if (eligibility.status !== "eligible") {
      diagnostics.push({ slug: vehicle.slug, status: eligibility.status });
      continue;
    }

    const fuelGroup = inferFuelGroup(
      vehicle.name,
      eligibility.selectedTrim.engineType,
      eligibility.profile?.fuelGroup
    );
    if (requiredFuel && fuelGroup !== requiredFuel) {
      diagnostics.push({ slug: vehicle.slug, status: "fuel_mismatch" });
      continue;
    }
    const effectiveTrimPrice = eligibility.selectedTrim.discountPrice
      ?? eligibility.selectedTrim.price;
    const standardMonthlyPayment = buildStandardRecommendScenario({
      vehiclePrice: effectiveTrimPrice,
      vehicleSurchargeRate: vehicle.surchargeRate,
      rankSurchargeRates: snapshot.rankSurchargeRates,
      rateConfigs: eligibility.rateConfigs,
      estimatedMonthly: eligibility.estimatedMonthly,
    }).monthlyPayment;
    if (!isWithinRecommendationBudgetRange(standardMonthlyPayment, input.budgetRange)) {
      diagnostics.push({ slug: vehicle.slug, status: "outside_budget_range" });
      continue;
    }

    const styleScore = STEP02_V3_POINTS[styleLevel];
    const followupBonus = getStep02V3FollowupBonus(input, vehicle.name);
    const conditionScore = input.stylePreference === "auto"
      ? autoConditionScore(input, eligibility)
      : 0;
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
      vehicle,
      eligibility,
      stylePreference: input.stylePreference,
      styleScore,
      followupBonus,
      autoConditionScore: conditionScore,
      rankScore: styleScore + followupBonus + conditionScore,
      popularity,
      companyPriority: eligibility.profile?.companyPriority ?? 0,
      profitPriority: eligibility.profile?.profitPriority ?? 0,
      immediateDeliveryAvailable: vehicle.immediateDeliveryAvailable ?? false,
      availableStockCount: vehicle.availableStockCount ?? 0,
      standardMonthlyPayment,
    });
    diagnostics.push({ slug: vehicle.slug, status: "eligible" });
  }

  const ranked = mixNearbyPopularityCandidates(
    deduplicateModels(candidates, input.budgetRange).slice(0, 3),
    selectionOptions.variationSeed
  );
  return {
    vehicles: ranked.map((candidate, index) =>
      toRecommendedVehicle(candidate, snapshot.rankSurchargeRates, index + 1)
    ),
    diagnostics,
  };
}

export async function finalizeStep02V3Reasons(
  vehicles: readonly Step02V3RecommendedVehicle[],
  input: RecommendInput
): Promise<Step02V3RecommendedVehicle[]> {
  const reasons = await Promise.all(vehicles.map((vehicle) => generateStep02V3Reason({
    industry: input.industry,
    industryDetail: input.industryDetail,
    preferences: input.preferences,
    stylePreference: vehicle.stylePreference,
    budgetRange: input.budgetRange ?? "auto",
    annualMileage: input.annualMileage,
    fuelPreference: input.fuelPreference,
    vehicleName: vehicle.vehicle.name,
    brand: vehicle.vehicle.brand,
    category: vehicle.vehicle.category,
    estimatedMonthly: vehicle.estimatedMonthly,
    fallback: vehicle.reason,
  })));

  return vehicles.map((vehicle, index) => ({
    ...vehicle,
    reason: reasons[index],
  }));
}

export async function recommendStep02V3(
  input: RecommendInput,
  selectionOptions: RecommendationSelectionOptions = {}
): Promise<Step02V3RecommendedVehicle[]> {
  const snapshot = await loadOverlapCandidateSnapshot();
  const vehicles = recommendStep02V3FromSnapshot(input, snapshot, selectionOptions).vehicles;
  return finalizeStep02V3Reasons(vehicles, input);
}
