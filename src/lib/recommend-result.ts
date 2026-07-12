import { z } from "zod";
import type {
  LegacyRecommendedVehicle,
  OverlapRecommendedVehicle,
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
  slug: z.string().min(1),
  popularConfigs: z.array(popularConfigSchema),
}).passthrough();

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
    isPopular: z.boolean(),
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

export interface StoredResultIssue {
  readonly path: readonly PropertyKey[];
  readonly code: string;
  readonly message: string;
}

export type StoredResultParseResult =
  | { readonly kind: "missing" }
  | { readonly kind: "legacy"; readonly vehicles: readonly LegacyRecommendedVehicle[] }
  | { readonly kind: "v2"; readonly vehicles: readonly OverlapRecommendedVehicle[] }
  | { readonly kind: "invalid"; readonly issues: readonly StoredResultIssue[] };

function issues(error: z.ZodError): StoredResultIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message,
  }));
}

export function parseStoredResultState(value: unknown): StoredResultParseResult {
  if (value === null || value === undefined) return { kind: "missing" };

  if (Array.isArray(value)) {
    const legacy = legacyResultSchema.safeParse(value);
    return legacy.success
      ? { kind: "legacy", vehicles: legacy.data }
      : { kind: "invalid", issues: issues(legacy.error) };
  }

  const overlap = overlapResultSchema.safeParse(value);
  return overlap.success
    ? { kind: "v2", vehicles: overlap.data.vehicles }
    : { kind: "invalid", issues: issues(overlap.error) };
}
