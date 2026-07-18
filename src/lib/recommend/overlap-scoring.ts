import {
  CHARGING_ADJUSTMENTS,
  OVERLAP_POINTS,
  OVERLAP_WEIGHTS,
  type OverlapProfile,
  type SuitabilityLevel,
} from "./overlap-profile";

type Industry = keyof OverlapProfile["scores"]["industry"];
type PrimaryPreference = keyof OverlapProfile["scores"]["primaryPreference"];
type ChildDetail = keyof OverlapProfile["scores"]["additionalCondition"]["family"]["details"];
type CargoDetail = keyof OverlapProfile["scores"]["additionalCondition"]["cargo"]["details"];
type ResidenceRegion = keyof OverlapProfile["scores"]["region"];
type ChargingEnvironment = "자택" | "직장" | "외부" | "없음";

interface BaseScoringInput {
  readonly industry: Industry;
  readonly industryDetail?: string;
  readonly budgetMax?: number;
  readonly primaryPreference?: PrimaryPreference;
  readonly annualMileage: 10_000 | 20_000 | 30_000;
  readonly residenceRegion: ResidenceRegion;
}

type AdditionalConditionInput =
  | {
      readonly situationPreference: "가족";
      readonly childDetail: ChildDetail;
      readonly cargoDetail?: never;
    }
  | {
      readonly situationPreference: "화물";
      readonly cargoDetail: CargoDetail;
      readonly childDetail?: never;
    }
  | {
      readonly situationPreference?: undefined;
      readonly childDetail?: never;
      readonly cargoDetail?: never;
    };

type FuelInput =
  | {
      readonly fuelPreference: "전기차";
      readonly chargingEnvironment: ChargingEnvironment;
    }
  | {
      readonly fuelPreference: "상관없음" | "가솔린/디젤" | "하이브리드";
      readonly chargingEnvironment?: never;
    };

export type OverlapScoringInput = BaseScoringInput & AdditionalConditionInput & FuelInput;

export type OverlapContributionAxis =
  | "industry"
  | "primaryPreference"
  | "additionalCondition"
  | "annualMileage"
  | "region"
  | "chargingEnvironment";

export interface OverlapContribution {
  readonly kind: "document" | "charging";
  readonly axis: OverlapContributionAxis;
  readonly selectedValue: string | null;
  readonly selectedDetail?: string;
  readonly level: SuitabilityLevel;
  readonly rawPoints: number;
  readonly weight: number | null;
  readonly weightedPoints: number;
  readonly evidenceLabel: string;
}

export interface OverlapScoreResult {
  readonly documentScore: number;
  readonly chargingAdjustment: number;
  readonly rankScore: number;
  readonly contributions: readonly OverlapContribution[];
}

type DocumentAxis = Exclude<OverlapContributionAxis, "chargingEnvironment">;

function documentContribution(
  axis: DocumentAxis,
  selectedValue: string | null,
  selectedDetail: string | undefined,
  level: SuitabilityLevel,
  weight: number,
  evidenceLabel: string
): OverlapContribution {
  const rawPoints = OVERLAP_POINTS[level];
  return {
    kind: "document",
    axis,
    selectedValue,
    ...(selectedDetail ? { selectedDetail } : {}),
    level,
    rawPoints,
    weight,
    weightedPoints: rawPoints * weight,
    evidenceLabel,
  };
}

function mileageKey(mileage: OverlapScoringInput["annualMileage"]): "10000" | "20000" | "30000" {
  if (mileage === 10_000) return "10000";
  if (mileage === 20_000) return "20000";
  return "30000";
}

function additionalContribution(
  input: OverlapScoringInput,
  profile: OverlapProfile
): OverlapContribution {
  if (input.situationPreference === "가족") {
    return documentContribution(
      "additionalCondition",
      "가족",
      input.childDetail,
      profile.scores.additionalCondition.family.details[input.childDetail],
      OVERLAP_WEIGHTS.additionalCondition,
      "자녀 동승 조건"
    );
  }

  if (input.situationPreference === "화물") {
    return documentContribution(
      "additionalCondition",
      "화물",
      input.cargoDetail,
      profile.scores.additionalCondition.cargo.details[input.cargoDetail],
      OVERLAP_WEIGHTS.additionalCondition,
      "적재 조건"
    );
  }

  return documentContribution(
    "additionalCondition",
    null,
    undefined,
    "none",
    OVERLAP_WEIGHTS.additionalCondition,
    "추가 조건 해당 없음"
  );
}

function chargingContribution(
  input: OverlapScoringInput,
  profile: OverlapProfile
): OverlapContribution | null {
  if (profile.fuelGroup !== "EV" || input.fuelPreference !== "전기차") return null;
  const level = profile.chargingFit[input.chargingEnvironment];
  return {
    kind: "charging",
    axis: "chargingEnvironment",
    selectedValue: input.chargingEnvironment,
    level,
    rawPoints: OVERLAP_POINTS[level],
    weight: null,
    weightedPoints: CHARGING_ADJUSTMENTS[level],
    evidenceLabel: `${input.chargingEnvironment} 충전환경 적합도`,
  };
}

export function scoreOverlapVehicle(
  input: OverlapScoringInput,
  profile: OverlapProfile
): OverlapScoreResult {
  const primaryLevel = input.primaryPreference
    ? profile.scores.primaryPreference[input.primaryPreference]
    : "none";
  const mileage = mileageKey(input.annualMileage);

  const documentContributions: OverlapContribution[] = [
    documentContribution(
      "industry",
      input.industry,
      input.industryDetail,
      profile.scores.industry[input.industry],
      OVERLAP_WEIGHTS.industry,
      `등록 형태 ${input.industry}`
    ),
    documentContribution(
      "primaryPreference",
      input.primaryPreference ?? null,
      undefined,
      primaryLevel,
      OVERLAP_WEIGHTS.primaryPreference,
      input.primaryPreference ? `차종 기준 ${input.primaryPreference}` : "차종 기준 해당 없음"
    ),
    additionalContribution(input, profile),
    documentContribution(
      "annualMileage",
      mileage,
      undefined,
      profile.scores.annualMileage[mileage],
      OVERLAP_WEIGHTS.annualMileage,
      `연 ${input.annualMileage / 10_000}만km 주행`
    ),
    documentContribution(
      "region",
      input.residenceRegion,
      undefined,
      profile.scores.region[input.residenceRegion],
      OVERLAP_WEIGHTS.region,
      `운행 지역 ${input.residenceRegion}`
    ),
  ];

  const documentScore = documentContributions.reduce(
    (total, contribution) => total + contribution.weightedPoints,
    0
  );
  const charging = chargingContribution(input, profile);
  const chargingAdjustment = charging?.weightedPoints ?? 0;

  return {
    documentScore,
    chargingAdjustment,
    rankScore: documentScore + chargingAdjustment,
    contributions: charging ? [...documentContributions, charging] : documentContributions,
  };
}
