import { describe, expect, it } from "vitest";
import { compileOverlapCatalog } from "./overlap-catalog";
import type { OverlapCandidateSnapshot, OverlapRuntimeVehicle } from "./overlap-candidate-loader";
import { recommendOverlapV2FromSnapshot } from "./recommend-overlap-v2";
import type { OverlapProfile } from "./overlap-profile";

function matrix(value: number) {
  return {
    "36_10000": value, "36_20000": value, "36_30000": value,
    "48_10000": value, "48_20000": value, "48_30000": value,
    "60_10000": value, "60_20000": value, "60_30000": value,
  };
}

function profile(documentName: string): OverlapProfile {
  const row = compileOverlapCatalog().find((candidate) => candidate.documentName === documentName);
  if (!row) throw new Error(`missing fixture profile: ${documentName}`);
  return row.profile;
}

function vehicle(slug: string, name: string, configuredProfile: unknown): OverlapRuntimeVehicle {
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
    config: { isActive: true, profile: configuredProfile },
    trims: [{
      id: `trim-${slug}`,
      name: "기본",
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
        minRateMatrix: matrix(0.02),
        maxRateMatrix: matrix(0.02),
        depositDiscountRate: -0.000523,
        prepayAdjustRate: 0.000073,
        financeCompany: { id: "finance", name: "테스트캐피탈", isActive: true, surchargeRate: 0 },
      }],
    }],
  };
}

function snapshot(vehicles: readonly OverlapRuntimeVehicle[]): OverlapCandidateSnapshot {
  return { vehicles, rankSurchargeRates: [1, 1.5, 2, 2.5] };
}

const baseInput = {
  industry: "개인",
  industryDetail: "직장인",
  preferences: [],
  annualMileage: 20_000,
  returnType: "반납형",
  residenceRegion: "일반",
};

describe("recommendOverlapV2FromSnapshot", () => {
  const mixed = snapshot([
    vehicle("hev", "더 뉴 카니발 HEV", profile("더 뉴 카니발 HEV")),
    vehicle("ev", "더 EV3", profile("더 EV3")),
    vehicle("ice", "더 뉴 쏘렌토", profile("더 뉴 쏘렌토")),
  ]);

  it.each([
    ["하이브리드", "HEV"],
    ["전기차", "EV"],
    ["가솔린/디젤", "ICE"],
  ] as const)("hard-filters %s to %s without trim engine inference", (fuelPreference, expected) => {
    const input = fuelPreference === "전기차"
      ? { ...baseInput, fuelPreference, chargingEnvironment: "외부" }
      : { ...baseInput, fuelPreference };
    const result = recommendOverlapV2FromSnapshot(input, mixed);
    expect(result.vehicles).toHaveLength(1);
    expect(result.vehicles[0]?.scoringVersion).toBe("overlap-v2");
    const selectedProfile = mixed.vehicles.find((row) => row.vehicleId === result.vehicles[0]?.vehicleId)?.config?.profile;
    expect(selectedProfile && typeof selectedProfile === "object" && "fuelGroup" in selectedProfile ? selectedProfile.fuelGroup : null).toBe(expected);
  });

  it("returns empty when every profile is invalid and never fills from legacy", () => {
    const result = recommendOverlapV2FromSnapshot(
      { ...baseInput, fuelPreference: "상관없음" },
      snapshot([vehicle("invalid", "잘못된 차량", { version: "overlap-v2" })])
    );
    expect(result.vehicles).toEqual([]);
    expect(result.diagnostics).toEqual([{ slug: "invalid", status: "invalid_profile" }]);
  });

  it("keeps scenario formulas and frozen scoring evidence together", () => {
    const result = recommendOverlapV2FromSnapshot({
      ...baseInput,
      fuelPreference: "하이브리드",
      primaryPreference: "안정감",
      situationPreference: "가족",
      childDetail: "영유아",
    }, mixed);
    const first = result.vehicles[0];
    expect(first?.score).toBe(first?.rankScore);
    expect(first?.documentScore).toBeGreaterThanOrEqual(0);
    expect(first?.contributions).toHaveLength(5);
    expect(first?.reason).toContain("영유아 자녀 동승 조건");
    expect(first?.reason).not.toContain("영유아 영유아");
    expect(first?.scenarios.conservative.depositAmount).toBe(8_000_000);
    expect(first?.scenarios.standard.depositAmount).toBe(0);
    expect(first?.scenarios.aggressive.prepayAmount).toBe(12_000_000);
    expect(first?.scenarios.standard).toMatchObject({
      contractMonths: 60,
      annualMileage: 20_000,
      prepayAmount: 0,
    });
    expect(first?.vehicle).toMatchObject({
      recommendedTrimId: "trim-hev",
      effectiveTrimPrice: 40_000_000,
      productType: "장기렌트",
    });
  });

  it("changes only the bounded detail/charging contribution", () => {
    const familyBase = { ...baseInput, fuelPreference: "하이브리드", situationPreference: "가족" };
    const infant = recommendOverlapV2FromSnapshot({ ...familyBase, childDetail: "영유아" }, mixed).vehicles[0];
    const teen = recommendOverlapV2FromSnapshot({ ...familyBase, childDetail: "중학생+" }, mixed).vehicles[0];
    expect(infant?.documentScore).not.toBe(teen?.documentScore);

    const evBase = { ...baseInput, fuelPreference: "전기차" };
    const external = recommendOverlapV2FromSnapshot({ ...evBase, chargingEnvironment: "외부" }, mixed).vehicles[0];
    const none = recommendOverlapV2FromSnapshot({ ...evBase, chargingEnvironment: "없음" }, mixed).vehicles[0];
    expect(external?.documentScore).toBe(none?.documentScore);
    expect(external?.chargingAdjustment).not.toBe(none?.chargingAdjustment);
  });

  it("filters recommendations above the selected no-deposit monthly budget", () => {
    const withoutBudget = recommendOverlapV2FromSnapshot(
      { ...baseInput, fuelPreference: "하이브리드" },
      mixed
    );
    expect(withoutBudget.vehicles[0]?.scenarios.standard.monthlyPayment).toBeGreaterThan(500_000);

    const withinBudget = recommendOverlapV2FromSnapshot(
      { ...baseInput, fuelPreference: "하이브리드", budgetMax: 500_000 },
      mixed
    );
    expect(withinBudget.vehicles).toEqual([]);
  });
});
