import { describe, expect, it } from "vitest";
import { compileOverlapCatalog } from "./overlap-catalog";
import type {
  OverlapCandidateSnapshot,
  OverlapRuntimeVehicle,
} from "./overlap-candidate-loader";
import { recommendOverlapV2FromSnapshot } from "./recommend-overlap-v2";
import type { OverlapProfile } from "./overlap-profile";

function matrix(value: number) {
  return {
    "36_10000": value,
    "36_20000": value,
    "36_30000": value,
    "48_10000": value,
    "48_20000": value,
    "48_30000": value,
    "60_10000": value,
    "60_20000": value,
    "60_30000": value,
  };
}

function profile(documentName: string): OverlapProfile {
  const row = compileOverlapCatalog().find(
    (candidate) => candidate.documentName === documentName
  );
  if (!row) throw new TypeError(`missing fixture profile: ${documentName}`);
  return row.profile;
}

function vehicle(
  slug: string,
  configuredProfile: OverlapProfile,
  isPopular: boolean = false
): OverlapRuntimeVehicle {
  return {
    vehicleId: `id-${slug}`,
    slug,
    brand: "테스트",
    name: slug,
    category: "SUV",
    isVisible: true,
    surchargeRate: 0,
    isPopular,
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
        financeCompany: {
          id: "finance",
          name: "테스트캐피탈",
          isActive: true,
          surchargeRate: 0,
        },
      }],
    }],
  };
}

function snapshot(
  vehicles: readonly OverlapRuntimeVehicle[]
): OverlapCandidateSnapshot {
  return {
    vehicles,
    rankSurchargeRates: [1, 1.5, 2, 2.5],
  };
}

const BASE_INPUT = {
  industry: "개인",
  preferences: [],
  annualMileage: 20_000,
  returnType: "반납형",
  residenceRegion: "일반",
};

describe("recommendOverlapV2FromSnapshot popularity policy", () => {
  it("tiers mapped rows first and freezes ranked and fallback evidence", () => {
    const sharedProfile = profile("더 뉴 카니발 HEV");
    const result = recommendOverlapV2FromSnapshot(
      { ...BASE_INPUT, fuelPreference: "하이브리드" },
      snapshot([
        vehicle("fallback", sharedProfile),
        vehicle("hyundai-11576", sharedProfile),
        vehicle("kia-11573", sharedProfile),
      ])
    );

    expect(result.vehicles.map((item) => item.vehicle.slug)).toEqual([
      "kia-11573",
      "hyundai-11576",
      "fallback",
    ]);
    expect(result.vehicles.map((item) => item.popularity)).toEqual([
      { period: "2026-05", rank: 2, registrationCount: 7_086 },
      { period: "2026-05", rank: 12, registrationCount: 2_296 },
      { period: "2026-05", rank: null, registrationCount: null },
    ]);
  });

  it("excludes a mapped conflict instead of filling from it", () => {
    const evProfile = profile("더 EV3");
    const conflictProfile: OverlapProfile = {
      ...evProfile,
      scores: {
        ...evProfile.scores,
        primaryPreference: {
          ...evProfile.scores.primaryPreference,
          안정감: "none",
        },
      },
    };
    const compatibleProfile: OverlapProfile = {
      ...evProfile,
      scores: {
        ...evProfile.scores,
        primaryPreference: {
          ...evProfile.scores.primaryPreference,
          안정감: "fit",
        },
      },
    };
    const result = recommendOverlapV2FromSnapshot({
      ...BASE_INPUT,
      fuelPreference: "전기차",
      chargingEnvironment: "외부",
      primaryPreference: "안정감",
    }, snapshot([
      vehicle("tesla-11738", conflictProfile),
      vehicle("compatible", compatibleProfile),
    ]));

    expect(result.vehicles.map((item) => item.vehicle.slug)).toEqual([
      "compatible",
    ]);
  });

  it("does not use homepage isPopular to order equal unranked candidates", () => {
    const sharedProfile = profile("더 뉴 쏘렌토");
    const result = recommendOverlapV2FromSnapshot(
      { ...BASE_INPUT, fuelPreference: "가솔린/디젤" },
      snapshot([
        vehicle("b", sharedProfile, true),
        vehicle("a", sharedProfile),
      ])
    );

    expect(result.vehicles.map((item) => item.vehicle.slug)).toEqual(["a", "b"]);
  });
});
