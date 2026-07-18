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
vi.mock("@/lib/llm-reason", () => ({
  generateReason: mocks.generateReason,
}));

import { recommendLegacyV1 } from "./recommend-legacy-v1";

const INPUT: RecommendInput = {
  industry: "개인",
  preferences: [],
  annualMileage: 20_000,
  returnType: "반납형",
};

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

interface VehicleIdentity {
  readonly slug: string;
  readonly isPopular?: boolean;
}

function vehicle(identity: VehicleIdentity) {
  return {
    id: `id-${identity.slug}`,
    slug: identity.slug,
    brand: "테스트",
    name: identity.slug,
    category: "SUV",
    isVisible: true,
    isPopular: identity.isPopular ?? false,
    slidingDoorOverride: null,
    advancedSafetyOverride: null,
    surchargeRate: 0,
    thumbnailUrl: "",
    thumbnailImageId: null,
    thumbnailImage: null,
    images: [],
    _count: { images: 0 },
    imageUrls: [],
    recConfigs: null,
    popularConfigs: [],
    trims: [{
      id: `trim-${identity.slug}`,
      name: "기본",
      price: 40_000_000,
      discountPrice: null,
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

function rateSheet(slug: string) {
  return {
    trimId: `trim-${slug}`,
    financeCompanyId: "finance",
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
  };
}

describe("recommendLegacyV1 popularity policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findManyRankSurcharges.mockResolvedValue([]);
    mocks.generateReason.mockResolvedValue("동일 추천 이유");
  });

  it("tiers top-30 candidates first and freezes ranked and fallback evidence", async () => {
    const slugs = ["fallback", "kia-11760", "kia-11573"];
    mocks.findManyVehicles.mockResolvedValue(slugs.map((slug) => vehicle({ slug })));
    mocks.findManyRateSheets.mockResolvedValue(slugs.map(rateSheet));

    const result = await recommendLegacyV1(INPUT);

    expect(result.map((item) => item.vehicle.slug)).toEqual([
      "kia-11573",
      "kia-11760",
      "fallback",
    ]);
    expect(result.map((item) => item.popularity)).toEqual([
      { period: "2026-05", rank: 2, registrationCount: 7_086 },
      { period: "2026-05", rank: 30, registrationCount: 1_265 },
      { period: "2026-05", rank: null, registrationCount: null },
    ]);
  });

  it("does not use homepage isPopular to order equal unranked candidates", async () => {
    mocks.findManyVehicles.mockResolvedValue([
      vehicle({ slug: "b", isPopular: true }),
      vehicle({ slug: "a" }),
    ]);
    mocks.findManyRateSheets.mockResolvedValue([
      rateSheet("b"),
      rateSheet("a"),
    ]);

    const result = await recommendLegacyV1(INPUT);

    expect(result.map((item) => item.vehicle.slug)).toEqual(["a", "b"]);
  });
});
