import { z } from "zod";

export const saveQuoteSchema = z.object({
  sessionId: z.string().min(1),
  vehicleSlug: z.string().min(1),
  trimId: z.string().min(1),
  selectedOptionIds: z.array(z.string()).default([]),
  extraOptionsPrice: z.number().int().min(0).default(0),
  contractMonths: z.number().int().refine((value) => [36, 48, 60].includes(value)),
  annualMileage: z.number().int().refine((value) => [10000, 20000, 30000].includes(value)),
  contractType: z.enum(["인수형", "반납형"]),
  customerType: z.enum(["individual", "self_employed", "corporate", "nonprofit"]).default("individual"),
  productType: z.enum(["장기렌트", "리스"]).default("장기렌트"),
  scenarioType: z.enum(["conservative", "standard", "aggressive"]),
  customDepositRate: z.number().min(0).max(30).optional(),
  customPrepayRate: z.number().min(0).max(30).optional(),
  exteriorColorId: z.string().nullable().optional(),
  interiorColorId: z.string().nullable().optional(),
  quoteType: z.enum(["AI", "DETAIL"]).default("DETAIL"),
}).refine(
  (input) => (input.customDepositRate ?? 0) === 0 || (input.customPrepayRate ?? 0) === 0,
  { message: "보증금과 선납금은 동시에 적용할 수 없습니다." }
);
