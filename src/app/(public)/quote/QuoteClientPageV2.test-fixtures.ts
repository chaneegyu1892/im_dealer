import { vi } from "vitest";
import type { QuoteResponse, VehicleListItem } from "@/types/api";

export const vehicles = [{
  id: "vehicle-preparing",
  slug: "preparing-car",
  name: "준비중 차량",
  brand: "아임",
  category: "SUV",
  basePrice: 40_000_000,
  evSubsidyRange: null,
  thumbnailUrl: "",
  isPopular: false,
  description: null,
  displayOrder: 1,
  defaultTrim: {
    name: "프리미엄",
    price: 40_000_000,
    engineType: "가솔린",
    fuelEfficiency: null,
    specs: null,
  },
  monthlyFrom: 0,
  highlights: [],
  tags: [],
}] satisfies VehicleListItem[];

function quoteScenario(monthlyPayment: number, depositAmount: number, prepayAmount: number) {
  return {
    monthlyPayment,
    depositAmount,
    prepayAmount,
    contractMonths: 60,
    annualMileage: 20000,
    contractType: "반납형",
    bestFinanceCompany: "테스트캐피탈",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
  };
}

export function createUnlockedCalculatedQuoteResult(): QuoteResponse {
  return {
    vehicleSlug: "preparing-car",
    trimId: "trim-preparing",
    trimName: "프리미엄",
    trimPrice: 40_000_000,
    optionsTotalPrice: 0,
    colorDelta: 0,
    totalVehiclePrice: 40_000_000,
    contractMonths: 60,
    annualMileage: 20000,
    contractType: "반납형",
    customerType: "individual",
    scenarios: {
      conservative: quoteScenario(610_000, 8_000_000, 0),
      standard: quoteScenario(700_000, 0, 0),
      aggressive: quoteScenario(530_000, 0, 12_000_000),
    },
    requiresConsultation: false,
  };
}

function writeRestore(
  requiresConsultation: boolean,
  locked = false,
  firstEntry = false,
): void {
  const unlockedResult = createUnlockedCalculatedQuoteResult();
  window.localStorage.setItem(
    "quote_image_restore",
    JSON.stringify({
      vehicleSlug: "preparing-car",
      customerType: "individual",
      selectedLineup: null,
      selectedTrimName: requiresConsultation ? null : "프리미엄",
      selectedOptionIds: [],
      contractCategory: "장기렌트",
      conditions: {
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
      },
      customRates: firstEntry
        ? { depositRate: 0, prepayRate: 30 }
        : {
            depositRate: requiresConsultation || locked ? 0 : 10,
            prepayRate: 0,
          },
      costMode: requiresConsultation ? "none" : "initial",
      baseStandard: requiresConsultation ? null : quoteScenario(700_000, 0, 0),
      quoteResult: {
        vehicleSlug: "preparing-car",
        trimId: "trim-preparing",
        trimName: "프리미엄",
        trimPrice: 40_000_000,
        optionsTotalPrice: 0,
        colorDelta: 0,
        totalVehiclePrice: 40_000_000,
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        customerType: "individual",
        scenarios: requiresConsultation
          ? {}
          : locked
            ? {
                conservative: {
                  ...quoteScenario(0, 0, 0),
                  locked: true,
                },
                standard: {
                  ...quoteScenario(0, 0, 0),
                  locked: true,
                },
                aggressive: unlockedResult.scenarios.aggressive,
              }
            : firstEntry
              ? {
                  conservative: quoteScenario(610_000, 8_000_000, 0),
                  standard: quoteScenario(700_000, 0, 0),
                  aggressive: quoteScenario(530_000, 0, 12_000_000),
                }
              : {
                  conservative: quoteScenario(610_000, 8_000_000, 0),
                  standard: quoteScenario(650_000, 4_000_000, 0),
                  aggressive: quoteScenario(530_000, 0, 12_000_000),
                },
        requiresConsultation,
      },
    })
  );
}

export function writeConsultationRestore(): void {
  writeRestore(true);
}

export function writeCalculatedRestore(): void {
  writeRestore(false);
}

export function writeLockedCalculatedRestore(): void {
  writeRestore(false, true);
}

export function writeFirstEntryRestore(): void {
  writeRestore(false, false, true);
}

export function savedQuoteSuccessData(overrides: Record<string, unknown> = {}) {
  return {
    id: "saved-quote",
    sessionId: "session-1",
    requiresConsultation: false,
    monthlyPayment: 640_000,
    totalCost: 38_400_000,
    pricingStatus: "CALCULATED" as const,
    depositRate: 10,
    prepayRate: 0,
    depositAmount: 4_000_000,
    prepayAmount: 0,
    bestFinanceCompany: "저장캐피탈",
    ...overrides,
  };
}

export function createFetchMock(saveStatus = 200) {
  return vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(async (input) => {
    const url = input.toString();
    if (url.endsWith("/colors") || url.endsWith("/trims")) {
      return Response.json({ success: true, data: [] });
    }
    if (url.endsWith("/quote") && url !== "/api/quote/save") {
      return Response.json({ success: true, data: createUnlockedCalculatedQuoteResult() });
    }
    if (url === "/api/quote/save") {
      return Response.json(
        saveStatus === 200
          ? { success: true, data: savedQuoteSuccessData() }
          : { error: "save failed" },
        { status: saveStatus }
      );
    }
    return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
  });
}
