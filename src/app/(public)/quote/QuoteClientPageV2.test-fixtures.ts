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
          standard: {
            monthlyPayment: 650_000,
            depositAmount: 4_000_000,
            prepayAmount: 0,
            contractMonths: 60,
            annualMileage: 20000,
            contractType: "반납형",
            bestFinanceCompany: "테스트캐피탈",
            purchaseSurcharge: 0,
            breakdown: null,
            surcharges: null,
            allFinanceResults: [],
          },
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
          ? { success: true, data: { id: "saved-quote" } }
          : { error: "save failed" },
        { status: saveStatus }
      );
    }
    return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
  });
}
