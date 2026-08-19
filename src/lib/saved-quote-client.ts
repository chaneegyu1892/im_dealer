import { z } from "zod";
import type { QuoteResponse } from "@/types/api";

const moneySchema = z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER);

export const savedQuoteClientDataSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  requiresConsultation: z.boolean(),
  monthlyPayment: z.number().int().min(0),
  totalCost: z.number().int().min(0),
  pricingStatus: z.enum(["CALCULATED", "CONSULTATION_REQUIRED"]),
  depositRate: z.number(),
  prepayRate: z.number(),
  depositAmount: moneySchema,
  prepayAmount: moneySchema,
  bestFinanceCompany: z.string(),
});

export type SavedQuoteClientData = z.infer<typeof savedQuoteClientDataSchema>;

export const savedQuoteResponseSchema = z.object({
  success: z.literal(true),
  data: savedQuoteClientDataSchema,
});

/** 저장 401/403 후보 URL. 호출부가 세션 없음을 확인한 뒤에만 따른다. */
export function quoteSaveLoginRedirect(input: {
  readonly status: number;
  readonly returnPath: string;
  readonly code?: string;
}): string | null {
  const loginRequired =
    input.status === 401 ||
    input.status === 403 ||
    input.code === "LOGIN_REQUIRED";
  if (!loginRequired) return null;
  return `/login?next=${encodeURIComponent(input.returnPath)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readMoney(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

export function toSavedQuoteClientData(input: {
  id: string;
  sessionId: string;
  monthlyPayment: number;
  totalCost: number;
  pricingStatus: "CALCULATED" | "CONSULTATION_REQUIRED";
  depositRate: number;
  prepayRate: number;
  breakdown?: unknown;
  bestFinanceCompany?: string;
}): SavedQuoteClientData {
  const breakdown = asRecord(input.breakdown);
  const quoteBreakdown = asRecord(breakdown.quoteBreakdown);
  const storedFinance = breakdown.bestFinanceCompany;
  return {
    id: input.id,
    sessionId: input.sessionId,
    requiresConsultation: input.pricingStatus === "CONSULTATION_REQUIRED",
    monthlyPayment: input.monthlyPayment,
    totalCost: input.totalCost,
    pricingStatus: input.pricingStatus,
    depositRate: input.depositRate,
    prepayRate: input.prepayRate,
    depositAmount: readMoney(quoteBreakdown.depositAmount),
    prepayAmount: readMoney(quoteBreakdown.prepayAmount),
    bestFinanceCompany: typeof storedFinance === "string" && storedFinance.trim()
      ? storedFinance.trim()
      : (input.bestFinanceCompany ?? ""),
  };
}

/** 고객 화면의 큰 숫자는 재계산 슬롯(standard)이다. 선납 30% 첫 페인트는 aggressive.
 * 저장 확정 금액을 두 슬롯에 맞춰 덮어 표시가 어긋나지 않게 한다. */
export function applySavedQuoteAmountsToDisplay(
  quote: QuoteResponse,
  saved: SavedQuoteClientData,
): QuoteResponse {
  if (saved.requiresConsultation || !quote.scenarios.standard) {
    return { ...quote, requiresConsultation: true };
  }

  const patchedStandard = {
    ...quote.scenarios.standard,
    monthlyPayment: saved.monthlyPayment,
    depositAmount: saved.depositAmount,
    prepayAmount: saved.prepayAmount,
    bestFinanceCompany: saved.bestFinanceCompany || quote.scenarios.standard.bestFinanceCompany,
  };
  const patchAggressive =
    saved.depositRate === 0 &&
    saved.prepayRate === 30 &&
    quote.scenarios.aggressive != null;

  return {
    ...quote,
    requiresConsultation: false,
    scenarios: {
      ...quote.scenarios,
      standard: patchedStandard,
      ...(patchAggressive
        ? {
            aggressive: {
              ...quote.scenarios.aggressive,
              monthlyPayment: saved.monthlyPayment,
              depositAmount: saved.depositAmount,
              prepayAmount: saved.prepayAmount,
              bestFinanceCompany: patchedStandard.bestFinanceCompany,
            },
          }
        : {}),
    },
  };
}
