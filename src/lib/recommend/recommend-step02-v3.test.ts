import { describe, expect, it } from "vitest";
import type { RecommendInput } from "@/types/recommendation";
import type { OverlapCandidateSnapshot, OverlapRuntimeVehicle } from "./overlap-candidate-loader";
import { recommendStep02V3FromSnapshot } from "./recommend-step02-v3";

const rateMatrix = {
  "36_10000": 0.02, "36_20000": 0.02, "36_30000": 0.02,
  "48_10000": 0.02, "48_20000": 0.02, "48_30000": 0.02,
  "60_10000": 0.02, "60_20000": 0.02, "60_30000": 0.02,
};

function vehicle(
  slug: string,
  name: string,
  engineType: string,
  overrides: Partial<OverlapRuntimeVehicle> = {}
): OverlapRuntimeVehicle {
  return {
    vehicleId: `id-${slug}`,
    slug,
    brand: "테스트",
    name,
    category: "SUV",
    isVisible: true,
    surchargeRate: 0,
    isPopular: false,
    thumbnailUrl: "/test.jpg",
    imageUrls: [],
    highlights: [],
    popularConfigs: [],
    config: null,
    availableStockCount: 0,
    immediateDeliveryAvailable: false,
    trims: [{
      id: `trim-${slug}`,
      name: "기본",
      engineType,
      price: 40_000_000,
      discountPrice: null,
      isDefault: true,
      isVisible: true,
      lineup: { name: "2027년형", isVisible: true },
      rateSheets: [{
        id: `rate-${slug}`,
        productType: "장기렌트",
        isActive: true,
        minVehiclePrice: 30_000_000,
        maxVehiclePrice: 50_000_000,
        minRateMatrix: rateMatrix,
        maxRateMatrix: rateMatrix,
        depositDiscountRate: -0.000523,
        prepayAdjustRate: 0.000073,
        financeCompany: { id: "finance", name: "테스트", isActive: true, surchargeRate: 0 },
      }],
    }],
    ...overrides,
  };
}

function snapshot(vehicles: readonly OverlapRuntimeVehicle[]): OverlapCandidateSnapshot {
  return { vehicles, rankSurchargeRates: [1, 1.5, 2, 2.5] };
}

function budgetSnapshot(
  vehicles: readonly OverlapRuntimeVehicle[]
): OverlapCandidateSnapshot {
  return { vehicles, rankSurchargeRates: [0] };
}

function pricedVehicle(
  slug: string,
  name: string,
  price: number,
  overrides: Partial<OverlapRuntimeVehicle> = {}
): OverlapRuntimeVehicle {
  const base = vehicle(slug, name, "가솔린", overrides);
  return {
    ...base,
    trims: base.trims.map((trim) => ({
      ...trim,
      price,
      rateSheets: trim.rateSheets.map((sheet) => ({
        ...sheet,
        minVehiclePrice: 1,
        maxVehiclePrice: 100_000_000,
      })),
    })),
  };
}

const baseInput: RecommendInput = {
  recommendationVersion: "step02-v3",
  industry: "개인",
  preferences: ["family-leisure", "가족"],
  stylePreference: "family-leisure",
  situationPreference: "가족",
  childDetail: "영유아",
  annualMileage: 20_000,
  fuelPreference: "상관없음",
  residenceRegion: "일반",
  returnType: "미정",
  budgetRange: "auto",
};

describe("recommendStep02V3FromSnapshot", () => {
  it("allows a 3+3 fit vehicle to outrank a 5-point best vehicle", () => {
    const result = recommendStep02V3FromSnapshot(baseInput, snapshot([
      vehicle("palisade", "디 올 뉴 팰리세이드", "가솔린"),
      vehicle("tucson", "더 뉴 투싼", "가솔린"),
    ]));
    expect(result.vehicles.map((item) => [item.vehicle.name, item.rankScore])).toEqual([
      ["더 뉴 투싼", 6],
      ["디 올 뉴 팰리세이드", 5],
    ]);
  });

  it("uses fuel as a hard filter and keeps GT/N document vehicles eligible", () => {
    const result = recommendStep02V3FromSnapshot({
      ...baseInput,
      fuelPreference: "전기차",
      chargingEnvironment: "외부",
    }, snapshot([
      vehicle("ev9-gt", "더 EV9 GT", "EV"),
      vehicle("palisade", "디 올 뉴 팰리세이드", "가솔린"),
    ]));
    expect(result.vehicles).toHaveLength(1);
    expect(result.vehicles[0]?.vehicle.name).toBe("더 EV9 GT");
  });

  it("scores same-model powertrains equally before applying the separate fuel filter", () => {
    const result = recommendStep02V3FromSnapshot({
      ...baseInput,
      budgetRange: "auto",
      stylePreference: "low-running-cost",
      situationPreference: undefined,
      childDetail: undefined,
      preferences: ["low-running-cost"],
      fuelPreference: "가솔린/디젤",
    }, snapshot([
      vehicle("avante-ice", "더 뉴 아반떼", "가솔린"),
      vehicle("avante-hev", "더 뉴 아반떼 HEV", "하이브리드"),
    ]));

    expect(result.vehicles.map((item) => [item.vehicle.name, item.styleScore]))
      .toEqual([["더 뉴 아반떼", 5]]);
    expect(result.diagnostics.find((item) => item.slug === "avante-hev")?.status)
      .toBe("fuel_mismatch");
  });

  it("does not exclude pickup models that the v3 PDF explicitly includes", () => {
    const result = recommendStep02V3FromSnapshot({
      ...baseInput,
      situationPreference: undefined,
      childDetail: undefined,
      preferences: ["family-leisure"],
    }, snapshot([
      vehicle("tasman", "타스만", "디젤", { category: "트럭" }),
      vehicle("musso", "무쏘 Q300", "디젤", { category: "트럭" }),
    ]));
    expect(result.vehicles.map((item) => item.vehicle.name)).toEqual(["무쏘 Q300", "타스만"]);
  });

  it("applies inventory only after score, model year, and company priority", () => {
    const result = recommendStep02V3FromSnapshot({
      ...baseInput,
      situationPreference: undefined,
      childDetail: undefined,
      preferences: ["city-compact"],
      stylePreference: "city-compact",
    }, snapshot([
      vehicle("morning", "더 뉴 모닝", "가솔린", { availableStockCount: 1 }),
      vehicle("venue", "베뉴", "가솔린", { availableStockCount: 5, immediateDeliveryAvailable: true }),
    ]));
    expect(result.vehicles.map((item) => item.vehicle.name)).toEqual(["베뉴", "더 뉴 모닝"]);
  });

  it.each([
    ["lte-500k", [500_000]],
    ["lte-800k", [800_000, 500_000]],
    ["lte-1000k", [1_000_000, 800_000, 500_000]],
  ] as const)("%s keeps only the lower side and orders closest from below", (budgetRange, expected) => {
    const result = recommendStep02V3FromSnapshot({
      ...baseInput,
      budgetRange,
      situationPreference: undefined,
      childDetail: undefined,
      preferences: ["family-leisure"],
    }, budgetSnapshot([
      pricedVehicle("monthly-500", "더 뉴 카니발", 25_000_000),
      pricedVehicle("monthly-800", "디 올 뉴 팰리세이드", 40_000_000),
      pricedVehicle("monthly-1000", "디 올 뉴 싼타페", 50_000_000),
      pricedVehicle("monthly-1100", "더 뉴 쏘렌토", 55_000_000),
    ]));

    expect(result.vehicles.map((item) => item.scenarios.standard.monthlyPayment)).toEqual(expected);
    expect(result.diagnostics.find((item) => item.slug === "monthly-1100")?.status)
      .toBe("outside_budget_range");
  });

  it("gte-1000k includes the exact boundary, orders closest from above, and never fills from below", () => {
    const result = recommendStep02V3FromSnapshot({
      ...baseInput,
      budgetRange: "gte-1000k",
      situationPreference: undefined,
      childDetail: undefined,
      preferences: ["family-leisure"],
    }, budgetSnapshot([
      pricedVehicle("monthly-900", "더 뉴 카니발", 45_000_000),
      pricedVehicle("monthly-1000", "디 올 뉴 팰리세이드", 50_000_000),
      pricedVehicle("monthly-1100", "디 올 뉴 싼타페", 55_000_000),
    ]));

    expect(result.vehicles.map((item) => item.scenarios.standard.monthlyPayment))
      .toEqual([1_000_000, 1_100_000]);
    expect(result.diagnostics.find((item) => item.slug === "monthly-900")?.status)
      .toBe("outside_budget_range");
  });

  it("auto does not filter or apply monthly proximity ahead of the existing PDF/tie order", () => {
    const result = recommendStep02V3FromSnapshot({
      ...baseInput,
      budgetRange: "auto",
      stylePreference: "auto",
      situationPreference: undefined,
      childDetail: undefined,
      preferences: ["auto"],
    }, budgetSnapshot([
      pricedVehicle("cheap-low-stock", "더 뉴 카니발", 25_000_000, { availableStockCount: 1 }),
      pricedVehicle("expensive-high-stock", "디 올 뉴 팰리세이드", 55_000_000, { availableStockCount: 9 }),
    ]));

    expect(result.vehicles.map((item) => item.vehicle.slug)).toEqual([
      "expensive-high-stock",
      "cheap-low-stock",
    ]);
  });
});
