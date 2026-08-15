import { describe, expect, it } from "vitest";
import type { QuoteResponse } from "@/types/api";
import {
  applySavedQuoteAmountsToDisplay,
  toSavedQuoteClientData,
} from "./saved-quote-client";

function scenario(monthlyPayment: number) {
  return {
    monthlyPayment,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 60,
    annualMileage: 20_000,
    contractType: "반납형",
    bestFinanceCompany: "화면캐피탈",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
  };
}

const displayedQuote = {
  vehicleSlug: "test-car",
  trimId: "trim-1",
  trimName: "기본",
  trimPrice: 40_000_000,
  contractMonths: 60,
  annualMileage: 20_000,
  contractType: "반납형",
  scenarios: {
    conservative: scenario(610_000),
    standard: scenario(650_000),
    aggressive: scenario(530_000),
  },
} as QuoteResponse;

describe("toSavedQuoteClientData", () => {
  it("reads deposit and finance company from the stored breakdown", () => {
    expect(toSavedQuoteClientData({
      id: "quote-1",
      sessionId: "session-1",
      monthlyPayment: 640_000,
      totalCost: 38_400_000,
      pricingStatus: "CALCULATED",
      depositRate: 10,
      prepayRate: 0,
      bestFinanceCompany: "요청값",
      breakdown: {
        bestFinanceCompany: "저장캐피탈",
        quoteBreakdown: { depositAmount: 4_000_000, prepayAmount: 0 },
      },
    })).toMatchObject({
      id: "quote-1",
      requiresConsultation: false,
      monthlyPayment: 640_000,
      depositAmount: 4_000_000,
      bestFinanceCompany: "저장캐피탈",
    });
  });
});

describe("applySavedQuoteAmountsToDisplay", () => {
  it("overwrites the displayed standard monthly payment with the persisted amount", () => {
    const next = applySavedQuoteAmountsToDisplay(displayedQuote, {
      id: "quote-1",
      sessionId: "session-1",
      requiresConsultation: false,
      monthlyPayment: 640_000,
      totalCost: 38_400_000,
      pricingStatus: "CALCULATED",
      depositRate: 10,
      prepayRate: 0,
      depositAmount: 4_000_000,
      prepayAmount: 0,
      bestFinanceCompany: "저장캐피탈",
    });

    expect(next.scenarios.standard).toMatchObject({
      monthlyPayment: 640_000,
      depositAmount: 4_000_000,
      bestFinanceCompany: "저장캐피탈",
    });
    expect(next.requiresConsultation).toBe(false);
  });

  it("also patches aggressive when the persisted rates are the public prepay 30%", () => {
    const next = applySavedQuoteAmountsToDisplay(displayedQuote, {
      id: "quote-1",
      sessionId: "session-1",
      requiresConsultation: false,
      monthlyPayment: 520_000,
      totalCost: 31_200_000,
      pricingStatus: "CALCULATED",
      depositRate: 0,
      prepayRate: 30,
      depositAmount: 0,
      prepayAmount: 12_000_000,
      bestFinanceCompany: "저장캐피탈",
    });

    expect(next.scenarios.standard.monthlyPayment).toBe(520_000);
    expect(next.scenarios.aggressive).toMatchObject({
      monthlyPayment: 520_000,
      prepayAmount: 12_000_000,
      bestFinanceCompany: "저장캐피탈",
    });
  });

  it("marks the displayed quote as consultation-only when save could not calculate", () => {
    const next = applySavedQuoteAmountsToDisplay(displayedQuote, {
      id: "quote-1",
      sessionId: "session-1",
      requiresConsultation: true,
      monthlyPayment: 0,
      totalCost: 0,
      pricingStatus: "CONSULTATION_REQUIRED",
      depositRate: 0,
      prepayRate: 0,
      depositAmount: 0,
      prepayAmount: 0,
      bestFinanceCompany: "",
    });

    expect(next.requiresConsultation).toBe(true);
  });
});
