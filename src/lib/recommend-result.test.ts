import { describe, expect, it } from "vitest";
import { parseStoredResultState } from "./recommend-result";

function scenario(monthlyPayment = 760_000) {
  return {
    monthlyPayment,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
  };
}

const legacyVehicle = {
  vehicleId: "veh_1",
  rank: 1,
  score: 70,
  reason: "조건에 적합한 차량이에요",
  highlights: ["고연비"],
  estimatedMonthly: 760_000,
  vehicle: {
    slug: "genesis-g80",
    name: "제네시스 G80",
    brand: "제네시스",
    category: "승용",
    thumbnailUrl: "/g80.png",
    defaultTrimName: "기본형",
    defaultTrimPrice: 60_000_000,
    popularConfigs: [],
  },
  scenarios: {
    conservative: scenario(710_000),
    standard: scenario(),
    aggressive: scenario(620_000),
  },
};

const v2Vehicle = {
  ...legacyVehicle,
  score: 12.04,
  scoringVersion: "overlap-v2",
  documentScore: 12,
  chargingAdjustment: 0.04,
  rankScore: 12.04,
  contributions: [
    {
      kind: "document",
      axis: "industry",
      selectedValue: "법인",
      level: "best",
      rawPoints: 5,
      weight: 0.6,
      weightedPoints: 3,
      evidenceLabel: "등록 형태 법인",
    },
  ],
  tieBreak: {
    modelYear: 2026,
    companyPriority: 0,
    isPopular: true,
    profitPriority: 0,
    slug: "genesis-g80",
  },
};

const v3Vehicle = {
  ...legacyVehicle,
  score: 8,
  scoringVersion: "step02-v3",
  stylePreference: "family-leisure",
  styleScore: 5,
  followupBonus: 3,
  autoConditionScore: 0,
  rankScore: 8,
  tieBreak: {
    modelYear: 2027,
    companyPriority: 10,
    immediateDeliveryAvailable: true,
    availableStockCount: 4,
    profitPriority: 5,
    slug: "genesis-g80",
  },
};

describe("stored recommendation result boundary", () => {
  it("returns missing only for SQL-null-like values", () => {
    expect(parseStoredResultState(null)).toEqual({ kind: "missing" });
    expect(parseStoredResultState(undefined)).toEqual({ kind: "missing" });
  });

  it("fails closed when the database value is JSON null rather than SQL NULL", () => {
    const result = parseStoredResultState(null, false);
    expect(result.kind).toBe("invalid");
  });

  it("keeps a valid legacy frozen array unchanged", () => {
    const value = [legacyVehicle];
    const result = parseStoredResultState(value);
    expect(result).toEqual({ kind: "legacy", vehicles: value });
  });

  it("keeps a monthly popularity evidence snapshot unchanged", () => {
    const withPopularity = {
      ...legacyVehicle,
      popularity: {
        period: "2026-06",
        rank: 19,
        registrationCount: 1_722,
      },
    };
    expect(parseStoredResultState([withPopularity])).toEqual({
      kind: "legacy",
      vehicles: [withPopularity],
    });
  });

  it("keeps a populated v2 envelope with complete evidence", () => {
    const value = { version: "overlap-v2", vehicles: [v2Vehicle] };
    const result = parseStoredResultState(value);
    expect(result).toEqual({ kind: "v2", vehicles: [v2Vehicle] });
  });

  it("keeps new v2 popularity evidence unchanged", () => {
    const withPopularity = {
      ...v2Vehicle,
      popularity: {
        period: "2026-05",
        rank: null,
        registrationCount: null,
      },
    };
    const value = { version: "overlap-v2", vehicles: [withPopularity] };
    expect(parseStoredResultState(value)).toEqual({
      kind: "v2",
      vehicles: [withPopularity],
    });
  });

  it.each([
    {
      period: "2026-4",
      rank: 1,
      registrationCount: 100,
    },
    {
      period: "2026-05",
      rank: null,
      registrationCount: 100,
    },
    {
      period: "2026-05",
      rank: 31,
      registrationCount: 100,
    },
  ])("rejects malformed popularity evidence", (popularity) => {
    const result = parseStoredResultState([{
      ...legacyVehicle,
      popularity,
    }]);
    expect(result.kind).toBe("invalid");
  });

  it("keeps an empty v2 envelope frozen", () => {
    expect(parseStoredResultState({ version: "overlap-v2", vehicles: [] })).toEqual({
      kind: "v2",
      vehicles: [],
    });
  });

  it("keeps a populated STEP 02 v3 envelope with complete evidence", () => {
    const value = { version: "step02-v3", vehicles: [v3Vehicle] };
    expect(parseStoredResultState(value)).toEqual({ kind: "v3", vehicles: [v3Vehicle] });
  });

  it("rejects a STEP 02 v3 envelope whose total does not match its evidence", () => {
    const result = parseStoredResultState({
      version: "step02-v3",
      vehicles: [{ ...v3Vehicle, rankScore: 7 }],
    });
    expect(result.kind).toBe("invalid");
  });

  it.each([
    "garbage",
    42,
    {},
    { version: "overlap-v2" },
    { version: "overlap-v2", vehicles: [{ ...v2Vehicle, rankScore: undefined }] },
    { version: "overlap-v2", vehicles: [legacyVehicle] },
  ])("fails closed for invalid non-null storage", (value) => {
    const result = parseStoredResultState(value);
    expect(result.kind).toBe("invalid");
    if (result.kind === "invalid") expect(result.issues.length).toBeGreaterThan(0);
  });

  it("keeps a historical empty legacy array frozen", () => {
    expect(parseStoredResultState([])).toEqual({ kind: "legacy", vehicles: [] });
  });

});
