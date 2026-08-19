// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { QuoteResponse } from "@/types/api";
import type { QuoteScenarioDetail } from "@/types/quote";
import {
  QUOTE_IMAGE_RESTORE_KEY,
  QUOTE_IMAGE_RESTORE_SCHEMA_VERSION,
  readQuoteImageRestore,
  saveQuoteImageRestore,
  type QuoteImageRestoreState,
} from "./quote-draft";

function scenario(monthlyPayment: number): QuoteScenarioDetail {
  return {
    monthlyPayment,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
    bestFinanceCompany: "테스트캐피탈",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
  };
}

function validQuoteResult(): QuoteResponse {
  return {
    vehicleSlug: "grandeur",
    trimId: "trim-1",
    trimName: "프리미엄",
    trimPrice: 40_000_000,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
    scenarios: {
      conservative: scenario(550_000),
      standard: scenario(600_000),
      aggressive: scenario(500_000),
    },
  };
}

function validRestore(
  overrides: Partial<QuoteImageRestoreState> = {},
): QuoteImageRestoreState {
  return {
    schemaVersion: QUOTE_IMAGE_RESTORE_SCHEMA_VERSION,
    vehicleSlug: "grandeur",
    customerType: "individual",
    selectedLineup: "lineup-1",
    selectedTrimName: "프리미엄",
    selectedOptionIds: ["opt-1"],
    contractCategory: "장기렌트",
    conditions: {
      contractMonths: 48,
      annualMileage: 20_000,
      contractType: "반납형",
    },
    customRates: { depositRate: 0, prepayRate: 30 },
    quoteResult: validQuoteResult(),
    ...overrides,
  };
}

describe("readQuoteImageRestore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("정상 스냅샷은 schemaVersion 을 채워 그대로 복원한다", () => {
    const input = validRestore();
    saveQuoteImageRestore(input);

    const restored = readQuoteImageRestore();

    expect(restored).not.toBeNull();
    expect(restored?.schemaVersion).toBe(QUOTE_IMAGE_RESTORE_SCHEMA_VERSION);
    expect(restored?.vehicleSlug).toBe("grandeur");
    expect(restored?.customRates).toEqual({ depositRate: 0, prepayRate: 30 });
    expect(restored?.quoteResult.scenarios.standard.monthlyPayment).toBe(600_000);
    expect(window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY)).not.toBeNull();
  });

  it("파손된 JSON 은 저장소를 폐기하고 null 을 반환한다", () => {
    window.localStorage.setItem(QUOTE_IMAGE_RESTORE_KEY, "{broken");

    expect(readQuoteImageRestore()).toBeNull();
    expect(window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY)).toBeNull();
  });

  it("구버전(schemaVersion 불일치) 스냅샷은 폐기하고 null 을 반환한다", () => {
    window.localStorage.setItem(
      QUOTE_IMAGE_RESTORE_KEY,
      JSON.stringify(validRestore({ schemaVersion: 0 })),
    );

    expect(readQuoteImageRestore()).toBeNull();
    expect(window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY)).toBeNull();
  });

  it("보증금과 선납이 동시에 양수인 스냅샷은 폐기하고 null 을 반환한다", () => {
    window.localStorage.setItem(
      QUOTE_IMAGE_RESTORE_KEY,
      JSON.stringify(
        validRestore({
          customRates: { depositRate: 20, prepayRate: 30 },
        }),
      ),
    );

    expect(readQuoteImageRestore()).toBeNull();
    expect(window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY)).toBeNull();
  });

  it("필수 필드가 비어 복원된 것처럼 보이는 스냅샷도 폐기한다", () => {
    window.localStorage.setItem(
      QUOTE_IMAGE_RESTORE_KEY,
      JSON.stringify({
        schemaVersion: QUOTE_IMAGE_RESTORE_SCHEMA_VERSION,
        vehicleSlug: "grandeur",
        quoteResult: {},
      }),
    );

    expect(readQuoteImageRestore()).toBeNull();
    expect(window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY)).toBeNull();
  });

  it("상담 필요 스냅샷(빈 시나리오·빈 trimId)은 저장 직후 복원한다", () => {
    const consultationResult = {
      vehicleSlug: "preparing-car",
      trimId: "",
      trimName: "",
      trimPrice: 40_000_000,
      totalVehiclePrice: 40_000_000,
      contractMonths: 60,
      annualMileage: 20_000,
      contractType: "반납형",
      customerType: "individual",
      scenarios: {},
      requiresConsultation: true,
    } as unknown as QuoteResponse;

    saveQuoteImageRestore(
      validRestore({
        vehicleSlug: "preparing-car",
        selectedTrimName: null,
        customRates: { depositRate: 0, prepayRate: 0 },
        quoteResult: consultationResult,
      }),
    );

    const restored = readQuoteImageRestore();
    expect(restored).not.toBeNull();
    expect(restored?.quoteResult.requiresConsultation).toBe(true);
    expect(restored?.quoteResult.trimId).toBe("");
    expect(restored?.quoteResult.scenarios).toEqual({});
    expect(window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY)).not.toBeNull();
  });

  it("상담 스냅샷도 보증금+선납 동시값은 폐기한다", () => {
    window.localStorage.setItem(
      QUOTE_IMAGE_RESTORE_KEY,
      JSON.stringify(
        validRestore({
          vehicleSlug: "preparing-car",
          customRates: { depositRate: 20, prepayRate: 30 },
          quoteResult: {
            vehicleSlug: "preparing-car",
            trimId: "",
            trimName: "",
            trimPrice: 40_000_000,
            contractMonths: 60,
            annualMileage: 20_000,
            contractType: "반납형",
            scenarios: {} as QuoteResponse["scenarios"],
            requiresConsultation: true,
          },
        }),
      ),
    );

    expect(readQuoteImageRestore()).toBeNull();
    expect(window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY)).toBeNull();
  });

  it("타입 불일치 필드(비율이 문자열)는 폐기한다", () => {
    const raw = validRestore();
    window.localStorage.setItem(
      QUOTE_IMAGE_RESTORE_KEY,
      JSON.stringify({
        ...raw,
        customRates: { depositRate: "10", prepayRate: 0 },
      }),
    );

    expect(readQuoteImageRestore()).toBeNull();
    expect(window.localStorage.getItem(QUOTE_IMAGE_RESTORE_KEY)).toBeNull();
  });
});
