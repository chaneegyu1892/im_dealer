import { z } from "zod";
import type {
  LegacyRecommendedVehicle,
  OverlapRecommendedVehicle,
  Step02V3RecommendedVehicle,
} from "@/types/recommendation";

const scenarioSchema = z.object({
  monthlyPayment: z.number(),
  depositAmount: z.number(),
  prepayAmount: z.number(),
  contractMonths: z.number(),
  annualMileage: z.number(),
  contractType: z.string(),
  locked: z.boolean().optional(),
}).passthrough();

const popularConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    trimOptionId: z.string().nullable().optional(),
  }).passthrough()),
}).passthrough();

const vehicleDetailSchema = z.object({
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  thumbnailUrl: z.string(),
  imageUrls: z.array(z.string()).optional(),
  defaultTrimName: z.string(),
  defaultTrimPrice: z.number(),
  recommendedTrimId: z.string().min(1).optional(),
  effectiveTrimPrice: z.number().positive().optional(),
  productType: z.enum(["장기렌트", "리스"]).optional(),
  slug: z.string().min(1),
  popularConfigs: z.array(popularConfigSchema),
}).passthrough();

const popularitySchema = z.object({
  period: z.literal("2026-05"),
  rank: z.number().int().min(1).max(30).nullable(),
  registrationCount: z.number().int().positive().nullable(),
}).strict().superRefine((popularity, context) => {
  if ((popularity.rank === null) !== (popularity.registrationCount === null)) {
    context.addIssue({
      code: "custom",
      message: "인기순위와 등록대수는 함께 있거나 함께 null이어야 합니다.",
    });
  }
});

const baseVehicleShape = {
  vehicleId: z.string().min(1),
  rank: z.number().int().positive(),
  score: z.number(),
  reason: z.string(),
  highlights: z.array(z.string()),
  estimatedMonthly: z.number(),
  vehicle: vehicleDetailSchema,
  scenarios: z.object({
    conservative: scenarioSchema,
    standard: scenarioSchema,
    aggressive: scenarioSchema,
  }).passthrough(),
  popularity: popularitySchema.optional(),
};

const legacyVehicleSchema = z.object({
  ...baseVehicleShape,
  scoringVersion: z.never().optional(),
}).passthrough();

const contributionSchema = z.object({
  kind: z.enum(["document", "charging"]),
  axis: z.enum([
    "industry",
    "primaryPreference",
    "additionalCondition",
    "annualMileage",
    "region",
    "chargingEnvironment",
  ]),
  selectedValue: z.string().nullable(),
  selectedDetail: z.string().optional(),
  level: z.enum(["best", "fit", "support", "none"]),
  rawPoints: z.number(),
  weight: z.number().nullable(),
  weightedPoints: z.number(),
  evidenceLabel: z.string(),
}).strict();

const overlapVehicleSchema = z.object({
  ...baseVehicleShape,
  scoringVersion: z.literal("overlap-v2"),
  documentScore: z.number().min(0).max(22.5),
  chargingAdjustment: z.number().min(-0.04).max(0.04),
  rankScore: z.number().min(-0.04).max(22.54),
  contributions: z.array(contributionSchema).readonly(),
  tieBreak: z.object({
    modelYear: z.number().int().min(0),
    companyPriority: z.number().int().min(0).max(100),
    isPopular: z.boolean().optional(),
    profitPriority: z.number().int().min(0).max(100),
    slug: z.string().min(1),
  }).strict(),
}).passthrough().superRefine((vehicle, context) => {
  if (Math.abs(vehicle.rankScore - (vehicle.documentScore + vehicle.chargingAdjustment)) > 1e-9) {
    context.addIssue({ code: "custom", path: ["rankScore"], message: "합산 점수가 일치하지 않습니다." });
  }
  if (Math.abs(vehicle.score - vehicle.rankScore) > 1e-9) {
    context.addIssue({ code: "custom", path: ["score"], message: "호환 점수가 rankScore와 다릅니다." });
  }
  if (vehicle.tieBreak.slug !== vehicle.vehicle.slug) {
    context.addIssue({ code: "custom", path: ["tieBreak", "slug"], message: "차량 slug가 일치하지 않습니다." });
  }
});

const legacyResultSchema = z.array(legacyVehicleSchema);
const overlapResultSchema = z.object({
  version: z.literal("overlap-v2"),
  vehicles: z.array(overlapVehicleSchema),
}).strict();

const step02V3VehicleSchema = z.object({
  ...baseVehicleShape,
  scoringVersion: z.literal("step02-v3"),
  stylePreference: z.enum([
    "family-leisure",
    "city-compact",
    "sedan-comfort",
    "low-running-cost",
    "premium-formal",
    "auto",
  ]),
  styleScore: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]),
  followupBonus: z.union([z.literal(0), z.literal(3)]),
  autoConditionScore: z.number().min(-0.04).max(22.54),
  rankScore: z.number().min(-0.04).max(25.54),
  tieBreak: z.object({
    modelYear: z.number().int().min(0),
    companyPriority: z.number().int().min(0).max(100),
    immediateDeliveryAvailable: z.boolean(),
    availableStockCount: z.number().int().nonnegative(),
    profitPriority: z.number().int().min(0).max(100),
    slug: z.string().min(1),
  }).strict(),
}).passthrough().superRefine((vehicle, context) => {
  if (Math.abs(vehicle.rankScore - (vehicle.styleScore + vehicle.followupBonus + vehicle.autoConditionScore)) > 1e-9) {
    context.addIssue({ code: "custom", path: ["rankScore"], message: "v3 합산 점수가 일치하지 않습니다." });
  }
  if (Math.abs(vehicle.score - vehicle.rankScore) > 1e-9) {
    context.addIssue({ code: "custom", path: ["score"], message: "호환 점수가 rankScore와 다릅니다." });
  }
  if (vehicle.tieBreak.slug !== vehicle.vehicle.slug) {
    context.addIssue({ code: "custom", path: ["tieBreak", "slug"], message: "차량 slug가 일치하지 않습니다." });
  }
  if (vehicle.stylePreference === "auto" && vehicle.styleScore !== 0) {
    context.addIssue({ code: "custom", path: ["styleScore"], message: "AI 자동 추천에는 스타일 점수를 적용하지 않습니다." });
  }
  if (vehicle.stylePreference !== "auto" && vehicle.autoConditionScore !== 0) {
    context.addIssue({ code: "custom", path: ["autoConditionScore"], message: "스타일 추천에는 자동 조건 점수를 적용하지 않습니다." });
  }
});

const step02V3ResultSchema = z.object({
  version: z.literal("step02-v3"),
  vehicles: z.array(step02V3VehicleSchema),
}).strict();

export interface StoredResultIssue {
  readonly path: readonly PropertyKey[];
  readonly code: string;
  readonly message: string;
}

export type StoredResultParseResult =
  | { readonly kind: "missing" }
  | { readonly kind: "legacy"; readonly vehicles: readonly LegacyRecommendedVehicle[] }
  | { readonly kind: "v2"; readonly vehicles: readonly OverlapRecommendedVehicle[] }
  | { readonly kind: "v3"; readonly vehicles: readonly Step02V3RecommendedVehicle[] }
  | { readonly kind: "invalid"; readonly issues: readonly StoredResultIssue[] };

function issues(error: z.ZodError): StoredResultIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
  }));
}

export function parseStoredResultState(
  value: unknown,
  isSqlNull: boolean = value === null || value === undefined
): StoredResultParseResult {
  if (isSqlNull) return { kind: "missing" };

  if (Array.isArray(value)) {
    const legacy = legacyResultSchema.safeParse(value);
    return legacy.success
      ? { kind: "legacy", vehicles: legacy.data }
      : { kind: "invalid", issues: issues(legacy.error) };
  }

  const overlap = overlapResultSchema.safeParse(value);
  if (overlap.success) return { kind: "v2", vehicles: overlap.data.vehicles };
  const step02V3 = step02V3ResultSchema.safeParse(value);
  return step02V3.success
    ? { kind: "v3", vehicles: step02V3.data.vehicles }
    : { kind: "invalid", issues: issues(step02V3.error) };
}
