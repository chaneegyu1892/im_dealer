import type { CustomerType } from "@/constants/customer-types";
import { isCustomerType } from "@/constants/customer-types";
import type { QuoteScenarioDetails } from "@/types/quote";
import type { QuoteResponse } from "@/types/api";

export const QUOTE_DRAFT_STORAGE_PREFIX = "quote_draft_";
export const LEGACY_QUOTE_STORAGE_PREFIX = "quote_";

/**
 * PDF 다운로드를 위해 카카오 로그인 후 견적 결과 화면으로 복귀할 때
 * 사용하는 sessionStorage 키. 로그인 콜백 후 한 번 읽고 즉시 삭제(consume).
 */
export const QUOTE_PDF_RESTORE_KEY = "quote_pdf_restore";

export interface QuotePdfRestoreState {
  vehicleSlug: string;
  customerType: CustomerType;
  selectedLineup: string | null;
  selectedTrimName: string | null;
  selectedOptionIds: string[];
  contractCategory: "장기렌트" | "리스";
  conditions: {
    contractMonths: number;
    annualMileage: number;
    contractType: "반납형" | "인수형";
  };
  customRates: { depositRate: number; prepayRate: number };
  quoteResult: QuoteResponse;
}

export function saveQuotePdfRestore(state: QuotePdfRestoreState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(QUOTE_PDF_RESTORE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("[saveQuotePdfRestore] failed", error);
  }
}

export function consumeQuotePdfRestore(): QuotePdfRestoreState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(QUOTE_PDF_RESTORE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(QUOTE_PDF_RESTORE_KEY);
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) return null;
  if (typeof parsed.vehicleSlug !== "string") return null;
  if (!isRecord(parsed.quoteResult)) return null;
  return parsed as unknown as QuotePdfRestoreState;
}

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
