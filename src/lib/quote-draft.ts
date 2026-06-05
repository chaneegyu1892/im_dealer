import type { CustomerType } from "@/constants/customer-types";
import { isCustomerType } from "@/constants/customer-types";
import type { QuoteScenarioDetails, QuoteScenarioDetail } from "@/types/quote";
import type { QuoteResponse } from "@/types/api";

export const QUOTE_DRAFT_STORAGE_PREFIX = "quote_draft_";
export const LEGACY_QUOTE_STORAGE_PREFIX = "quote_";

/**
 * 견적 결과(step 3)를 새로고침·뒤로가기·카카오 로그인 복귀에도 유지하기 위한 저장본 키.
 * localStorage 에 저장하며, 읽을 때 삭제하지 않는다(반복 새로고침에도 복원 가능).
 * 복원 트리거는 URL 의 restore=1 마커 — 마커가 없으면(새 견적 시작) 저장본을 읽지 않는다.
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
  exteriorColorId?: string | null;
  interiorColorId?: string | null;
  /** 초기비용 패널 펼침 상태(없음/있음) — 직전 화면 그대로 복원 */
  costMode?: "none" | "initial";
  /** 가산(보증/선납) 적용 전 기준 standard 시나리오 — 복원 후 reset 정확도용 */
  baseStandard?: QuoteScenarioDetail | null;
  quoteResult: QuoteResponse;
}

export function saveQuotePdfRestore(state: QuotePdfRestoreState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUOTE_PDF_RESTORE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("[saveQuotePdfRestore] failed", error);
  }
}

/** 저장본을 읽는다(삭제하지 않음). 새로고침마다 반복 복원 가능. */
export function readQuotePdfRestore(): QuotePdfRestoreState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(QUOTE_PDF_RESTORE_KEY);
  if (!raw) return null;
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) return null;
  if (typeof parsed.vehicleSlug !== "string") return null;
  if (!isRecord(parsed.quoteResult)) return null;
  return parsed as unknown as QuotePdfRestoreState;
}

export type QuoteDraftScenarioType = "conservative" | "standard" | "aggressive";
export type QuoteDraftProductType = "장기렌트" | "리스";
export type QuoteDraftContractType = "반납형" | "인수형";

export interface QuoteDraftCustomRates {
  depositRate: number;
  prepayRate: number;
}

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
  customRates: QuoteDraftCustomRates;
  optionsTotalPrice?: number;
  totalVehiclePrice?: number;
  exteriorColorId?: string | null;
  interiorColorId?: string | null;
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

function normalizeCustomRates(value: unknown): QuoteDraftCustomRates {
  if (!isRecord(value)) return { depositRate: 0, prepayRate: 0 };
  const depositRate = typeof value.depositRate === "number" ? value.depositRate : 0;
  const prepayRate = typeof value.prepayRate === "number" ? value.prepayRate : 0;
  return { depositRate, prepayRate };
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
    customRates: normalizeCustomRates(value.customRates),
    optionsTotalPrice:
      typeof value.optionsTotalPrice === "number" ? value.optionsTotalPrice : undefined,
    totalVehiclePrice:
      typeof value.totalVehiclePrice === "number" ? value.totalVehiclePrice : undefined,
    exteriorColorId:
      typeof value.exteriorColorId === "string" ? value.exteriorColorId : null,
    interiorColorId:
      typeof value.interiorColorId === "string" ? value.interiorColorId : null,
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
