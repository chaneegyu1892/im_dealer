import { beforeEach, describe, expect, it, vi } from "vitest";
import { compileOverlapCatalog } from "./recommend/overlap-catalog";

const mocks = vi.hoisted(() => ({ vehicleFindMany: vi.fn() }));
vi.mock("./prisma", () => ({
  prisma: {
    vehicle: { findMany: mocks.vehicleFindMany },
    recommendationLog: {},
  },
}));

import { getVehicleAiConfigs } from "./admin-ai-queries";

function matrix(value: number) {
  return {
    "36_10000": value, "36_20000": value, "36_30000": value,
    "48_10000": value, "48_20000": value, "48_30000": value,
    "60_10000": value, "60_20000": value, "60_30000": value,
  };
}

function baseVehicle(id: string, slug: string) {
  return {
    id,
    slug,
    name: slug,
    brand: "테스트",
    category: "SUV",
    isVisible: true,
    recConfigs: null,
    trims: [],
  };
}

describe("getVehicleAiConfigs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns every vehicle with shared 10k/20k/30k eligibility truth", async () => {
    const profile = compileOverlapCatalog().find((row) => row.profile.fuelGroup === "HEV")?.profile;
    expect(profile).toBeDefined();
    const eligible = {
      ...baseVehicle("eligible", "eligible-hev"),
      recConfigs: {
        id: "config",
        scoreMatrix: profile,
        highlights: [],
        aiCaption: null,
        isActive: true,
        updatedAt: new Date("2026-07-12T00:00:00.000Z"),
      },
      trims: [{
        id: "trim",
        name: "기본",
        price: 40_000_000,
        isDefault: true,
        isVisible: true,
        lineup: { name: "2027년형", isVisible: true },
        rateSheets: [{
          id: "rate",
          isActive: true,
          minVehiclePrice: 30_000_000,
          maxVehiclePrice: 50_000_000,
          minRateMatrix: matrix(0.02),
          maxRateMatrix: matrix(0.02),
          depositDiscountRate: -0.000523,
          prepayAdjustRate: 0.000073,
          financeCompany: { id: "finance", name: "캐피탈", isActive: true, surchargeRate: 0 },
        }],
      }],
    };
    mocks.vehicleFindMany.mockResolvedValue([
      eligible,
      baseVehicle("missing", "missing-profile"),
      { ...baseVehicle("hidden", "hidden"), isVisible: false },
      baseVehicle("excluded", "kia-11792"),
    ]);

    const result = await getVehicleAiConfigs();
    expect(result).toHaveLength(4);
    expect(result.find((row) => row.vehicle.id === "eligible")?.coverage).toEqual({ "10000": "eligible", "20000": "eligible", "30000": "eligible" });
    expect(result.find((row) => row.vehicle.id === "missing")?.profileState).toBe("missing");
    expect(result.find((row) => row.vehicle.id === "missing")?.coverage["20000"]).toBe("no_profile");
    expect(result.find((row) => row.vehicle.id === "hidden")?.coverage["20000"]).toBe("hidden");
    expect(result.find((row) => row.vehicle.id === "excluded")?.coverage["20000"]).toBe("excluded_vehicle_class");
    expect(result.find((row) => row.vehicle.id === "excluded")?.exclusion?.kind).toBe("document_slug");
  });
});
