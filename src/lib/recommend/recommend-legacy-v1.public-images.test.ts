import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecommendInput } from "@/types/recommendation";

const mocks = vi.hoisted(() => ({
  findManyVehicles: vi.fn(),
  findManyRateSheets: vi.fn(),
  findManyRankSurcharges: vi.fn(),
  generateReason: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findMany: mocks.findManyVehicles },
    capitalRateSheet: { findMany: mocks.findManyRateSheets },
    rankSurchargeConfig: { findMany: mocks.findManyRankSurcharges },
  },
}));
vi.mock("@/lib/llm-reason", () => ({ generateReason: mocks.generateReason }));

import { recommendLegacyV1 } from "./recommend-legacy-v1";

function matrix(value: number) {
  return {
    "36_10000": value, "36_20000": value, "36_30000": value,
    "48_10000": value, "48_20000": value, "48_30000": value,
    "60_10000": value, "60_20000": value, "60_30000": value,
  };
}

const input: RecommendInput = {
  industry: "개인",
  preferences: [],
  annualMileage: 20_000,
  returnType: "반납형",
};

function rawVehicle(thumbnailState: "active" | "legacy" | "hidden" | "managed" | "custom") {
  const linked = thumbnailState === "active" || thumbnailState === "hidden";
  const thumbnailUrl = thumbnailState === "managed" ? "/managed-source.webp" : `/${thumbnailState}.webp`;
  const images = thumbnailState === "managed"
    ? [{ type: "COVER", sourceUrl: thumbnailUrl, storageUrl: "/managed-mirror.webp", isVisible: true, deletedAt: null }]
    : thumbnailState === "custom"
      ? [{ type: "MAIN", sourceUrl: "/other-source.webp", storageUrl: "/other.webp", isVisible: false, deletedAt: null }]
      : [];
  return {
    id: "vehicle-1",
    slug: "kia-11573",
    brand: "테스트",
    name: "테스트 차량",
    category: "SUV",
    isVisible: true,
    isPopular: false,
    slidingDoorOverride: null,
    advancedSafetyOverride: null,
    surchargeRate: 0,
    thumbnailUrl,
    thumbnailImageId: linked ? `image-${thumbnailState}` : null,
    thumbnailImage: linked ? {
      vehicleId: "vehicle-1",
      isVisible: thumbnailState === "active",
      deletedAt: null,
      storageUrl: thumbnailUrl,
    } : null,
    images,
    _count: { images: thumbnailState === "legacy" ? 0 : 1 },
    imageUrls: ["/legacy-gallery.webp"],
    recConfigs: null,
    popularConfigs: [],
    trims: [{
      id: "trim-1",
      name: "기본",
      price: 40_000_000,
      discountPrice: null as number | null,
      engineType: "GASOLINE",
      fuelEfficiency: 10,
      detailedSpecs: null,
      isDefault: true,
      isVisible: true,
      lineup: null,
      options: [],
    }],
  };
}

const rateSheet = {
  trimId: "trim-1",
  financeCompanyId: "finance-1",
  minVehiclePrice: 30_000_000,
  maxVehiclePrice: 50_000_000,
  minRateMatrix: matrix(0.02),
  maxRateMatrix: matrix(0.02),
  depositDiscountRate: -0.000523,
  prepayAdjustRate: 0.000073,
  financeCompany: {
    name: "테스트캐피탈",
    surchargeRate: 0,
  },
} as const;

function rateSheetFor(trimId: string) {
  return { ...rateSheet, trimId };
}

describe("recommendLegacyV1 public thumbnail projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findManyRateSheets.mockResolvedValue([rateSheet]);
    mocks.findManyRankSurcharges.mockResolvedValue([]);
    mocks.generateReason.mockResolvedValue("동일 추천 이유");
  });

  it.each([
    ["active", "/active.webp", []],
    ["legacy", "/legacy.webp", ["/legacy-gallery.webp"]],
    ["hidden", "", []],
    ["managed", "/managed-source.webp", []],
    ["custom", "/custom.webp", []],
  ] as const)("projects %s image state safely into a new legacy recommendation", async (state, expectedThumbnail, expectedGallery) => {
    mocks.findManyVehicles.mockResolvedValue([rawVehicle(state)]);

    const [result] = await recommendLegacyV1(input);

    expect(result?.vehicle.thumbnailUrl).toBe(expectedThumbnail);
    expect(result?.vehicle.imageUrls).toEqual(expectedGallery);
    expect(mocks.findManyVehicles.mock.calls[0]?.[0].include).toHaveProperty("_count");
  });

  it("changes only image projection, not ranking or quote scenarios", async () => {
    mocks.findManyVehicles.mockResolvedValueOnce([rawVehicle("active")]);
    const [active] = await recommendLegacyV1(input);
    mocks.findManyVehicles.mockResolvedValueOnce([rawVehicle("hidden")]);
    const [hidden] = await recommendLegacyV1(input);

    expect(active).toBeDefined();
    expect(hidden).toBeDefined();
    expect({
      rank: hidden?.rank,
      score: hidden?.score,
      estimatedMonthly: hidden?.estimatedMonthly,
      scenarios: hidden?.scenarios,
    }).toEqual({
      rank: active?.rank,
      score: active?.score,
      estimatedMonthly: active?.estimatedMonthly,
      scenarios: active?.scenarios,
    });
  });
});

describe("recommendLegacyV1 recommendation contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findManyRankSurcharges.mockResolvedValue([]);
    mocks.generateReason.mockResolvedValue("동일 추천 이유");
  });

  it("hard-filters mixed lineups by the selected fuel and uses rental rates only", async () => {
    const vehicle = rawVehicle("active");
    vehicle.trims = [
      { ...vehicle.trims[0], id: "trim-ice", engineType: "GASOLINE", isDefault: true },
      { ...vehicle.trims[0], id: "trim-hev", engineType: "HEV", isDefault: false },
    ];
    mocks.findManyVehicles.mockResolvedValue([vehicle]);
    mocks.findManyRateSheets.mockResolvedValue([
      rateSheetFor("trim-ice"),
      rateSheetFor("trim-hev"),
    ]);

    const [result] = await recommendLegacyV1({
      ...input,
      fuelPreference: "하이브리드",
      annualMileage: 10_000,
    });

    expect(result?.vehicle.recommendedTrimId).toBe("trim-hev");
    expect(result?.vehicle.productType).toBe("장기렌트");
    expect(result?.scenarios.standard).toMatchObject({
      contractMonths: 60,
      annualMileage: 20_000,
      depositAmount: 0,
      prepayAmount: 0,
    });
    expect(mocks.findManyRateSheets).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ productType: "장기렌트" }),
    }));
  });

  it("does not force the most expensive trim for a luxury preference", async () => {
    const vehicle = rawVehicle("active");
    vehicle.trims = [
      { ...vehicle.trims[0], id: "trim-default", price: 50_000_000, isDefault: true },
      { ...vehicle.trims[0], id: "trim-top", price: 80_000_000, isDefault: false },
    ];
    mocks.findManyVehicles.mockResolvedValue([vehicle]);
    mocks.findManyRateSheets.mockResolvedValue([
      rateSheetFor("trim-default"),
      { ...rateSheetFor("trim-top"), maxVehiclePrice: 90_000_000 },
    ]);

    const [result] = await recommendLegacyV1({
      ...input,
      preferences: ["고급"],
      primaryPreference: "고급",
    });

    expect(result?.vehicle.recommendedTrimId).toBe("trim-default");
    expect(result?.vehicle.defaultTrimPrice).toBe(50_000_000);
  });

  it("calculates every displayed scenario from the discounted price", async () => {
    const vehicle = rawVehicle("active");
    vehicle.trims = [{
      ...vehicle.trims[0],
      price: 50_000_000,
      discountPrice: 40_000_000,
    }];
    mocks.findManyVehicles.mockResolvedValue([vehicle]);
    mocks.findManyRateSheets.mockResolvedValue([rateSheet]);

    const [result] = await recommendLegacyV1(input);

    expect(result?.vehicle.defaultTrimPrice).toBe(50_000_000);
    expect(result?.vehicle.effectiveTrimPrice).toBe(40_000_000);
    expect(result?.estimatedMonthly).toBe(result?.scenarios.standard.monthlyPayment);
    expect(result?.scenarios.conservative.depositAmount).toBe(8_000_000);
    expect(result?.scenarios.aggressive.prepayAmount).toBe(12_000_000);
  });

});
