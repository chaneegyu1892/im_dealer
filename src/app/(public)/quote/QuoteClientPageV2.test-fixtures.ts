import { vi } from "vitest";
import type { VehicleListItem } from "@/types/api";

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

function writeRestore(requiresConsultation: boolean): void {
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
      customRates: { depositRate: requiresConsultation ? 0 : 10, prepayRate: 0 },
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
        scenarios: requiresConsultation ? {} : {
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

export function createFetchMock(saveStatus = 200) {
  return vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(async (input) => {
    const url = input.toString();
    if (url.endsWith("/colors") || url.endsWith("/trims")) {
      return Response.json({ success: true, data: [] });
    }
    if (url === "/api/quote/save") {
      return Response.json(
        saveStatus === 200
          ? { success: true, data: { id: "saved-quote", sessionId: "session-1" } }
          : { error: "save failed" },
        { status: saveStatus }
      );
    }
    return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
  });
}
