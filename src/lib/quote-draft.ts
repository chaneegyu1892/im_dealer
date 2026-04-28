import type { CustomerType } from "@/constants/customer-types";
import { isCustomerType } from "@/constants/customer-types";
import type { QuoteScenarioDetails } from "@/types/quote";

export const QUOTE_DRAFT_STORAGE_PREFIX = "quote_draft_";
export const LEGACY_QUOTE_STORAGE_PREFIX = "quote_";

export type QuoteDraftScenarioType = "conservative" | "standard" | "aggressive";
export type QuoteDraftProductType = "장기렌트" | "리스";
export type QuoteDraftContractType = "반납형" | "인수형";

export interface QuoteDraft {
  schemaVersion: 1;
  sessionId: string;
  vehicleSlug: string;
  trimId: string;
  selectedOptionIds: string[];
  contractMonths: number;
  annualMileage: number;
  contractType: QuoteDraftContractType;
  productType: QuoteDraftProductType;
  customerType: CustomerType;
  scenarios: QuoteScenarioDetails;
  optionsTotalPrice?: number;
  totalVehiclePrice?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeContractType(value: unknown): QuoteDraftContractType {
  return value === "인수형" ? "인수형" : "반납형";
}

function normalizeProductType(value: unknown): QuoteDraftProductType {
  return value === "리스" ? "리스" : "장기렌트";
}

function normalizeSelectedOptionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeDraft(value: unknown, expectedSessionId: string): QuoteDraft | null {
  if (!isRecord(value)) return null;
  if (value.sessionId !== expectedSessionId) return null;
  if (typeof value.vehicleSlug !== "string" || value.vehicleSlug.length === 0) return null;
  if (typeof value.trimId !== "string" || value.trimId.length === 0) return null;
  if (typeof value.contractMonths !== "number") return null;
  if (typeof value.annualMileage !== "number") return null;
  if (!isRecord(value.scenarios)) return null;

  const customerType =
    typeof value.customerType === "string" && isCustomerType(value.customerType)
      ? value.customerType
      : "individual";

  return {
    schemaVersion: 1,
    sessionId: expectedSessionId,
    vehicleSlug: value.vehicleSlug,
    trimId: value.trimId,
    selectedOptionIds: normalizeSelectedOptionIds(value.selectedOptionIds),
    contractMonths: value.contractMonths,
    annualMileage: value.annualMileage,
    contractType: normalizeContractType(value.contractType),
    productType: normalizeProductType(value.productType),
    customerType,
    scenarios: value.scenarios as unknown as QuoteScenarioDetails,
    optionsTotalPrice:
      typeof value.optionsTotalPrice === "number" ? value.optionsTotalPrice : undefined,
    totalVehiclePrice:
      typeof value.totalVehiclePrice === "number" ? value.totalVehiclePrice : undefined,
  };
}

export function parseQuoteDraft(value: string | null, expectedSessionId: string): QuoteDraft | null {
  if (!value) return null;
  return normalizeDraft(parseJson(value), expectedSessionId);
}

export function parseLegacyQuoteDraft(
  value: string | null,
  expectedSessionId: string
): QuoteDraft | null {
  if (!value) return null;
  return normalizeDraft(parseJson(value), expectedSessionId);
}
