import { z } from "zod";
import type { QuoteResponse } from "@/types/api";
import type {
  FinanceCompanyQuote,
  QuoteBreakdown,
  QuoteScenarioDetail,
  QuoteScenarioDetails,
  SurchargeDetail,
} from "@/types/quote";

const moneySchema = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);
const rateSchema = z.number().finite();
const labelSchema = z.string().trim().max(160);

const quoteBreakdownSchema: z.ZodType<QuoteBreakdown> = z.object({
  vehiclePrice: moneySchema,
  recoveryRate: rateSchema,
  baseMonthly: moneySchema,
  depositAmount: moneySchema,
  prepayAmount: moneySchema,
  depositDiscount: rateSchema,
  prepayAdjust: rateSchema,
  monthlyBeforeSurcharge: rateSchema,
});

const surchargeSchema: z.ZodType<SurchargeDetail> = z.object({
  rankSurcharge: rateSchema,
  vehicleSurcharge: rateSchema,
  financeSurcharge: rateSchema,
  totalSurcharge: rateSchema,
});

const financeCompanyQuoteSchema: z.ZodType<FinanceCompanyQuote> = z.object({
  financeCompanyName: labelSchema,
  rank: z.number().int().min(1),
  monthlyPayment: moneySchema,
  baseMonthly: moneySchema,
  surcharges: surchargeSchema,
});

export const quoteScenarioSchema: z.ZodType<QuoteScenarioDetail> = z.object({
  monthlyPayment: moneySchema,
  depositAmount: moneySchema,
  prepayAmount: moneySchema,
  contractMonths: z.number().int().min(1).max(120),
  annualMileage: z.number().int().min(0).max(1_000_000),
  contractType: labelSchema,
  bestFinanceCompany: labelSchema,
  purchaseSurcharge: moneySchema,
  breakdown: quoteBreakdownSchema.nullable(),
  surcharges: surchargeSchema.nullable(),
  allFinanceResults: z.array(financeCompanyQuoteSchema).max(100),
  rangeExceeded: z.boolean().optional(),
  locked: z.boolean().optional(),
});

export const quoteScenariosSchema: z.ZodType<QuoteScenarioDetails> = z.object({
  conservative: quoteScenarioSchema,
  standard: quoteScenarioSchema,
  aggressive: quoteScenarioSchema,
});

export const calculatedQuoteResponseSchema: z.ZodType<QuoteResponse> = z.object({
  vehicleSlug: z.string().trim().min(1).max(200),
  trimId: z.string().trim().min(1).max(200),
  trimName: labelSchema,
  trimPrice: moneySchema,
  discountPrice: moneySchema.nullable().optional(),
  optionsTotalPrice: moneySchema.optional(),
  colorDelta: z
    .number()
    .finite()
    .min(-Number.MAX_SAFE_INTEGER)
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  totalVehiclePrice: moneySchema.optional(),
  contractMonths: z.number().int().min(1).max(120),
  annualMileage: z.number().int().min(0).max(1_000_000),
  contractType: labelSchema,
  customerType: labelSchema.optional(),
  scenarios: quoteScenariosSchema,
  requiresConsultation: z.boolean().optional(),
});

export const successfulCalculatedQuoteResponseSchema = z.object({
  success: z.literal(true),
  data: calculatedQuoteResponseSchema,
});
