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
export const QUOTE_IMAGE_RESTORE_KEY = "quote_image_restore";
/** 견적 복원 스냅샷 스키마. 불일치·누락은 폐기하고 1단계로 폴백한다. */
export const QUOTE_IMAGE_RESTORE_SCHEMA_VERSION = 1 as const;

export interface QuoteImageRestoreState {
  /** 저장 시 주입. 구버전·누락은 복원하지 않는다. */
  schemaVersion?: typeof QUOTE_IMAGE_RESTORE_SCHEMA_VERSION | number;
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

export function saveQuoteImageRestore(state: QuoteImageRestoreState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: QuoteImageRestoreState = {
      ...state,
      schemaVersion: QUOTE_IMAGE_RESTORE_SCHEMA_VERSION,
    };
    window.localStorage.setItem(QUOTE_IMAGE_RESTORE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("[saveQuoteImageRestore] failed", error);
  }
}

function discardQuoteImageRestore(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(QUOTE_IMAGE_RESTORE_KEY);
  } catch {
    // 폐기 실패해도 호출측은 null 폴백이면 된다
  }
}

/** 저장본을 읽는다. 파손·구버전·필수필드 누락·보증/선납 동시값은 폐기 후 null(1단계 폴백). */
export function readQuoteImageRestore(): QuoteImageRestoreState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY);
  if (!raw) return null;
  const parsed = parseJson(raw);
  const restored = normalizeQuoteImageRestore(parsed);
  if (!restored) {
    discardQuoteImageRestore();
    return null;
  }
  return restored;
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
  source?: "AI" | "DETAIL";
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidRestoreScenario(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const monthly = value.monthlyPayment;
  if (!(monthly === null || isFiniteNumber(monthly))) return false;
  return isFiniteNumber(value.depositAmount) && isFiniteNumber(value.prepayAmount);
}

function isValidRestoreQuoteResult(value: unknown): value is QuoteResponse {
  if (!isRecord(value)) return false;
  if (typeof value.vehicleSlug !== "string" || value.vehicleSlug.length === 0) return false;
  if (typeof value.trimId !== "string") return false;
  if (typeof value.trimName !== "string") return false;
  if (!isFiniteNumber(value.trimPrice)) return false;
  if (!isFiniteNumber(value.contractMonths)) return false;
  if (!isFiniteNumber(value.annualMileage)) return false;
  if (typeof value.contractType !== "string") return false;
  if (!isRecord(value.scenarios)) return false;
  // 회수율 부재 등 정상 상담 응답은 scenarios 가 비고 trimId 가 빈 문자열일 수 있다.
  // 시나리오 완전성만 면제하고, 스키마·배타 비율 검증은 호출측에서 그대로 적용한다.
  if (value.requiresConsultation === true) return true;
  if (value.trimId.length === 0) return false;
  return (
    isValidRestoreScenario(value.scenarios.conservative) &&
    isValidRestoreScenario(value.scenarios.standard) &&
    isValidRestoreScenario(value.scenarios.aggressive)
  );
}

function parseExclusiveCustomRates(
  value: unknown,
): { depositRate: number; prepayRate: number } | null {
  if (!isRecord(value)) return null;
  if (!isFiniteNumber(value.depositRate) || !isFiniteNumber(value.prepayRate)) return null;
  if (value.depositRate < 0 || value.prepayRate < 0) return null;
  // 계산기는 보증금/선납 배타 분기 — 동시 양수는 우회 유입으로 폐기
  if (value.depositRate > 0 && value.prepayRate > 0) return null;
  return { depositRate: value.depositRate, prepayRate: value.prepayRate };
}

function normalizeQuoteImageRestore(value: unknown): QuoteImageRestoreState | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== QUOTE_IMAGE_RESTORE_SCHEMA_VERSION) return null;
  if (typeof value.vehicleSlug !== "string" || value.vehicleSlug.length === 0) return null;
  if (typeof value.customerType !== "string" || !isCustomerType(value.customerType)) return null;
  if (!(typeof value.selectedLineup === "string" || value.selectedLineup === null)) return null;
  if (!(typeof value.selectedTrimName === "string" || value.selectedTrimName === null)) return null;
  if (!Array.isArray(value.selectedOptionIds)) return null;
  if (!value.selectedOptionIds.every((item): item is string => typeof item === "string")) {
    return null;
  }
  if (value.contractCategory !== "장기렌트" && value.contractCategory !== "리스") return null;
  if (!isRecord(value.conditions)) return null;
  if (!isFiniteNumber(value.conditions.contractMonths)) return null;
  if (!isFiniteNumber(value.conditions.annualMileage)) return null;
  if (value.conditions.contractType !== "반납형" && value.conditions.contractType !== "인수형") {
    return null;
  }
  const customRates = parseExclusiveCustomRates(value.customRates);
  if (!customRates) return null;
  if (!isValidRestoreQuoteResult(value.quoteResult)) return null;
  if (value.costMode !== undefined && value.costMode !== "none" && value.costMode !== "initial") {
    return null;
  }
  if (value.baseStandard !== undefined && value.baseStandard !== null && !isValidRestoreScenario(value.baseStandard)) {
    return null;
  }

  return {
    schemaVersion: QUOTE_IMAGE_RESTORE_SCHEMA_VERSION,
    vehicleSlug: value.vehicleSlug,
    customerType: value.customerType,
    selectedLineup: value.selectedLineup,
    selectedTrimName: value.selectedTrimName,
    selectedOptionIds: value.selectedOptionIds,
    contractCategory: value.contractCategory,
    conditions: {
      contractMonths: value.conditions.contractMonths,
      annualMileage: value.conditions.annualMileage,
      contractType: value.conditions.contractType,
    },
    customRates,
    exteriorColorId:
      typeof value.exteriorColorId === "string" ? value.exteriorColorId : value.exteriorColorId === null ? null : undefined,
    interiorColorId:
      typeof value.interiorColorId === "string" ? value.interiorColorId : value.interiorColorId === null ? null : undefined,
    costMode: value.costMode,
    baseStandard: value.baseStandard === undefined
      ? undefined
      : (value.baseStandard as QuoteScenarioDetail | null),
    quoteResult: value.quoteResult,
  };
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
    source: value.source === "AI" ? "AI" : "DETAIL",
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
