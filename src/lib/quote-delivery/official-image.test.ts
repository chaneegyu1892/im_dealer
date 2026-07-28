import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildVehicleScenarios: vi.fn(),
}));

vi.mock("@/lib/quote-scenarios", () => ({
  buildVehicleScenarios: mocks.buildVehicleScenarios,
}));

import { buildOfficialDeliveryImageData } from "./official-image";

function scenario(monthlyPayment: number) {
  return {
    monthlyPayment,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
    bestFinanceCompany: "현재 금융사",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
  };
}

const savedQuote = {
  id: "quote-1",
  vehicleId: "vehicle-1",
  trimId: "trim-1",
  contractMonths: 48,
  annualMileage: 20_000,
  depositRate: 0,
  prepayRate: 30,
  contractType: "반납형",
  monthlyPayment: 430_000,
  pricingStatus: "CALCULATED",
  exteriorColorId: null,
  interiorColorId: null,
  breakdown: {
    scenarioType: "aggressive",
    productType: "리스",
    vehicleName: "저장된 차량명",
    vehicleBrand: "저장된 제조사",
    trimName: "저장된 트림",
    trimPrice: 41_000_000,
    selectedOptions: [{ id: "option-1", name: "저장 옵션", price: 1_000_000 }],
    totalVehiclePrice: 42_000_000,
    bestFinanceCompany: "저장 금융사",
    quoteBreakdown: { prepayAmount: 12_600_000 },
  },
};

describe("official quote delivery image data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildVehicleScenarios.mockResolvedValue({
      ok: true,
      data: {
        vehicleName: "현재 차량명",
        vehicleBrand: "현재 제조사",
        trimName: "현재 트림",
        trimPrice: 40_000_000,
        selectedOptions: [{ id: "option-1", name: "현재 옵션", price: 1_100_000 }],
        totalVehiclePrice: 41_100_000,
        exteriorColor: null,
        interiorColor: null,
        scenarios: {
          conservative: scenario(610_000),
          standard: scenario(700_000),
          aggressive: scenario(530_000),
        },
      },
    });
  });

  it("uses persisted quote values for the selected official scenario and server calculation for comparison scenarios", async () => {
    const result = await buildOfficialDeliveryImageData(savedQuote);

    expect(result).toMatchObject({
      ok: true,
      data: {
        vehicleName: "저장된 차량명",
        vehicleBrand: "저장된 제조사",
        trimName: "저장된 트림",
        trimPrice: 41_000_000,
        totalVehiclePrice: 42_000_000,
        productType: "리스",
        scenarioType: "aggressive",
        selectedOptions: [{ name: "저장 옵션", price: 1_000_000 }],
        scenarios: {
          standard: expect.objectContaining({ monthlyPayment: 700_000 }),
          aggressive: expect.objectContaining({
            monthlyPayment: 430_000,
            prepayAmount: 12_600_000,
            bestFinanceCompany: "저장 금융사",
          }),
        },
      },
    });
    expect(mocks.buildVehicleScenarios).toHaveBeenCalledWith({
      vehicleSlugOrId: "vehicle-1",
      trimId: "trim-1",
      selectedOptionIds: ["option-1"],
      contractMonths: 48,
      annualMileage: 20_000,
      contractType: "반납형",
      exteriorColorId: null,
      interiorColorId: null,
      productType: "리스",
    });
  });

  it("does not create an official delivery image for a consultation-only quote", async () => {
    const result = await buildOfficialDeliveryImageData({
      ...savedQuote,
      pricingStatus: "CONSULTATION_REQUIRED",
    });

    expect(result).toEqual({
      ok: false,
      error: { status: 409, error: "자동 산출된 견적만 카카오톡으로 전송할 수 있습니다." },
    });
    expect(mocks.buildVehicleScenarios).not.toHaveBeenCalled();
  });
});
