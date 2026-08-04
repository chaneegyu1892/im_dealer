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

  // 연료 선호 "상관없음"은 연료별 30위 네 목록을 하나로 합친 최대 120위 풀을
  // 사용한다. 30위 상한은 단일 전체 30위 스냅샷 시절의 잔재라 결과 freeze 를
  // 통째로 무효화시켰다.
  it("keeps a pooled fuel popularity rank above the per-fuel 30 limit", () => {
    const withPooledRank = {
      ...v3Vehicle,
      popularity: {
        period: "2026-06",
        rank: 54,
        registrationCount: 812,
      },
    };
    const value = { version: "step02-v3", vehicles: [withPooledRank] };
    expect(parseStoredResultState(value)).toEqual({
      kind: "v3",
      vehicles: [withPooledRank],
      nearMissVehicles: [],
    });
  });

  it("keeps the last pooled rank of the four fuel rankings", () => {
    const withLastRank = {
      ...legacyVehicle,
      popularity: {
        period: "2026-06",
        rank: 120,
        registrationCount: 101,
      },
    };
    expect(parseStoredResultState([withLastRank])).toEqual({
      kind: "legacy",
      vehicles: [withLastRank],
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
      rank: 121,
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
    expect(parseStoredResultState(value)).toEqual({
      kind: "v3",
      vehicles: [v3Vehicle],
      nearMissVehicles: [],
    });
  });

  // 예산 하나 때문에 잘린 차를 결과 화면에서 안내하려면 freeze 스냅샷에
  // 함께 얼려둬야 한다. 재계산하면 같은 세션이 흔들린다.
  it("freezes the near miss list alongside the recommended vehicles", () => {
    const nearMiss = { ...v3Vehicle, vehicleId: "veh_near", estimatedMonthly: 1_100_000 };
    const value = {
      version: "step02-v3",
      vehicles: [v3Vehicle],
      nearMissVehicles: [nearMiss],
    };
    expect(parseStoredResultState(value)).toEqual({
      kind: "v3",
      vehicles: [v3Vehicle],
      nearMissVehicles: [nearMiss],
    });
  });

  it("reads a v3 envelope saved before the near miss list existed", () => {
    const value = { version: "step02-v3", vehicles: [v3Vehicle] };
    const parsed = parseStoredResultState(value);
    expect(parsed.kind === "v3" && parsed.nearMissVehicles).toEqual([]);
  });

  it("rejects a near miss entry that fails the same evidence rules", () => {
    const value = {
      version: "step02-v3",
      vehicles: [v3Vehicle],
      nearMissVehicles: [{ ...v3Vehicle, score: 999 }],
    };
    expect(parseStoredResultState(value).kind).toBe("invalid");
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
