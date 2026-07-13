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
  preferences: ["안정감"],
  primaryPreference: "안정감",
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
    slug: "test-car",
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
