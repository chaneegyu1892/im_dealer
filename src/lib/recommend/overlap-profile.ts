import { z } from "zod";

export const INDUSTRY_PROFILE_KEYS = ["법인", "개인사업자", "개인"];
export const PRIMARY_PREFERENCE_PROFILE_KEYS = ["안정감", "주차편의", "경제성", "고급"];
export const CHILD_DETAIL_PROFILE_KEYS = ["영유아", "미취학", "초등", "중학생+"];
export const CARGO_DETAIL_PROFILE_KEYS = ["소형 박스", "대형 화물"];
export const ANNUAL_MILEAGE_PROFILE_KEYS = ["10000", "20000", "30000"];
export const REGION_PROFILE_KEYS = ["일반", "강원·산간", "제주"];
export const CHARGING_PROFILE_KEYS = ["자택", "직장", "외부", "없음"];

export const OVERLAP_POINTS = Object.freeze({
  best: 5,
  fit: 3,
  support: 1,
  none: 0,
});

export const OVERLAP_WEIGHTS = Object.freeze({
  industry: 0.6,
  primaryPreference: 1.4,
  additionalCondition: 1,
  annualMileage: 0.8,
  region: 0.7,
});

export const CHARGING_ADJUSTMENTS = Object.freeze({
  best: 0.04,
  fit: 0.02,
  support: 0,
  none: -0.04,
});

export const suitabilityLevelSchema = z.enum(["best", "fit", "support", "none"]);
export type SuitabilityLevel = z.infer<typeof suitabilityLevelSchema>;

const industryScoresSchema = z.object({
  법인: suitabilityLevelSchema,
  개인사업자: suitabilityLevelSchema,
  개인: suitabilityLevelSchema,
}).strict();

const primaryPreferenceScoresSchema = z.object({
  안정감: suitabilityLevelSchema,
  주차편의: suitabilityLevelSchema,
  경제성: suitabilityLevelSchema,
  고급: suitabilityLevelSchema,
}).strict();

const childDetailScoresSchema = z.object({
  영유아: suitabilityLevelSchema,
  미취학: suitabilityLevelSchema,
  초등: suitabilityLevelSchema,
  "중학생+": suitabilityLevelSchema,
}).strict();

const cargoDetailScoresSchema = z.object({
  "소형 박스": suitabilityLevelSchema,
  "대형 화물": suitabilityLevelSchema,
}).strict();

const additionalConditionScoresSchema = z.object({
  family: z.object({
    default: suitabilityLevelSchema,
    details: childDetailScoresSchema,
  }).strict(),
  cargo: z.object({
    default: suitabilityLevelSchema,
    details: cargoDetailScoresSchema,
  }).strict(),
}).strict();

const annualMileageScoresSchema = z.object({
  "10000": suitabilityLevelSchema,
  "20000": suitabilityLevelSchema,
  "30000": suitabilityLevelSchema,
}).strict();

const regionScoresSchema = z.object({
  일반: suitabilityLevelSchema,
  "강원·산간": suitabilityLevelSchema,
  제주: suitabilityLevelSchema,
}).strict();

const chargingFitSchema = z.object({
  자택: suitabilityLevelSchema,
  직장: suitabilityLevelSchema,
  외부: suitabilityLevelSchema,
  없음: suitabilityLevelSchema,
}).strict();

const scoresSchema = z.object({
  industry: industryScoresSchema,
  primaryPreference: primaryPreferenceScoresSchema,
  additionalCondition: additionalConditionScoresSchema,
  annualMileage: annualMileageScoresSchema,
  region: regionScoresSchema,
}).strict();

const profileBaseShape = {
  version: z.literal("overlap-v2"),
  scores: scoresSchema,
  companyPriority: z.number().int().min(0).max(100),
  profitPriority: z.number().int().min(0).max(100),
};

const evProfileSchema = z.object({
  ...profileBaseShape,
  fuelGroup: z.literal("EV"),
  chargingFit: chargingFitSchema,
}).strict();

const hevProfileSchema = z.object({
  ...profileBaseShape,
  fuelGroup: z.literal("HEV"),
}).strict();

const iceProfileSchema = z.object({
  ...profileBaseShape,
  fuelGroup: z.literal("ICE"),
}).strict();

export const overlapProfileSchema = z.discriminatedUnion("fuelGroup", [
  evProfileSchema,
  hevProfileSchema,
  iceProfileSchema,
]);

export type OverlapProfile = z.infer<typeof overlapProfileSchema>;
export type FuelGroup = OverlapProfile["fuelGroup"];

export interface OverlapProfileIssue {
  readonly path: readonly PropertyKey[];
  readonly code: string;
  readonly message: string;
}

export type OverlapProfileParseResult =
  | { readonly kind: "valid"; readonly profile: OverlapProfile }
  | { readonly kind: "legacy"; readonly version: string | null }
  | { readonly kind: "invalid"; readonly issues: readonly OverlapProfileIssue[] };

const versionProbeSchema = z.object({ version: z.unknown().optional() }).passthrough();

export function parseOverlapProfile(value: unknown): OverlapProfileParseResult {
  const probe = versionProbeSchema.safeParse(value);
  const version = probe.success && typeof probe.data.version === "string"
    ? probe.data.version
    : null;

  if (version !== "overlap-v2") {
    return { kind: "legacy", version };
  }

  const parsed = overlapProfileSchema.safeParse(value);
  if (parsed.success) return { kind: "valid", profile: parsed.data };

  return {
    kind: "invalid",
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path,
      code: issue.code,
      message: issue.message,
    })),
  };
}
