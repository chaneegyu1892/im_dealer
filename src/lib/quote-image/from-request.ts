// 클라이언트가 보낸 부분 견적 페이로드를 렌더러가 요구하는 PDFQuoteData 로 정규화한다.
// /api/quote/image(다운로드)와 /api/quote/deliver(카톡 전송)가 동일한 견적서를 만들도록 공유한다.

import { z } from "zod";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import { quoteScenariosSchema } from "@/lib/quote-response-schema";

const moneySchema = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);
const labelSchema = z.string().trim().max(160);

const quoteColorSchema = z.object({
  name: labelSchema,
  hexCode: z.string().trim().max(32),
  priceDelta: z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
});

const quoteImageBodySchema = z.object({
  vehicleName: labelSchema.min(1),
  vehicleBrand: labelSchema.optional(),
  trimName: labelSchema.optional(),
  trimPrice: moneySchema.optional(),
  selectedOptions: z
    .array(z.object({ name: labelSchema, price: moneySchema }))
    .max(100)
    .optional(),
  totalVehiclePrice: moneySchema.optional(),
  productType: labelSchema.optional(),
  contractMonths: z.number().int().min(1).max(120).optional(),
  annualMileage: z.number().int().min(0).max(1_000_000).optional(),
  contractType: labelSchema.optional(),
  scenarioType: z.enum(["conservative", "standard", "aggressive"]).optional(),
  scenarios: quoteScenariosSchema,
  exteriorColor: quoteColorSchema.nullable().optional(),
  interiorColor: quoteColorSchema.nullable().optional(),
});

export function buildQuoteImageData(
  body: unknown,
  userEmail: string | null
): PDFQuoteData {
  const input = quoteImageBodySchema.parse(body);

  return {
    vehicleName: input.vehicleName,
    vehicleBrand: input.vehicleBrand ?? "",
    trimName: input.trimName ?? "",
    trimPrice: input.trimPrice ?? 0,
    selectedOptions: input.selectedOptions ?? [],
    totalVehiclePrice: input.totalVehiclePrice ?? input.trimPrice ?? 0,
    productType: input.productType ?? "장기렌트",
    contractMonths: input.contractMonths ?? 48,
    annualMileage: input.annualMileage ?? 20_000,
    contractType: input.contractType ?? "반납형",
    scenarioType: input.scenarioType,
    scenarios: input.scenarios,
    userEmail,
    exteriorColor: input.exteriorColor ?? null,
    interiorColor: input.interiorColor ?? null,
  };
}
