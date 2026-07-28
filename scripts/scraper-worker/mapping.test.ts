import { describe, it, expect } from "vitest";
import { buildDraftFromTrimResults, RATE_KEYS, emptyRates } from "./mapping";
import type { ScrapeJobParams, TrimScrapeResult } from "../../src/types/scraper";

const params: ScrapeJobParams = {
  trimIds: ["t1", "t2"],
  vehicleId: "v1",
  lineupIds: ["l1"],
  weekOf: "2026-06-08",
  minVehiclePrice: 30000000,
  maxVehiclePrice: 40000000,
};

function fullBase(v: number): Record<string, number> {
  return Object.fromEntries(RATE_KEYS.map((k) => [k, v]));
}

describe("buildDraftFromTrimResults", () => {
  it("저렴한 트림→min, 비싼 트림→max 로 매핑한다", () => {
    const results: TrimScrapeResult[] = [
      {
        trimId: "t2",
        matchConfidence: "exact",
        externalTrimLabel: "B",
        vehiclePrice: 38000000,
        baseRates: fullBase(600000),
        depositRate36_10000: 580000,
        prepayRate36_10000: 610000,
        warnings: [],
      },
      {
        trimId: "t1",
        matchConfidence: "exact",
        externalTrimLabel: "A",
        vehiclePrice: 32000000,
        baseRates: fullBase(500000),
        depositRate36_10000: 480000,
        prepayRate36_10000: 510000,
        warnings: [],
      },
    ];

    const draft = buildDraftFromTrimResults(results, params, "장기렌트", "2026-06-10T00:00:00.000Z");

    expect(draft.minVehiclePrice).toBe(32000000);
    expect(draft.maxVehiclePrice).toBe(38000000);
    expect(draft.minBaseRates["36_10000"]).toBe(500000);
    expect(draft.maxBaseRates["36_10000"]).toBe(600000);
    expect(draft.minDepositRates["36_10000"]).toBe(480000);
    expect(draft.maxDepositRates["36_10000"]).toBe(580000);
    expect(draft.minPrepayRates["36_10000"]).toBe(510000);
    expect(draft.maxPrepayRates["36_10000"]).toBe(610000);
    expect(draft.trims.find((trim) => trim.trimId === "t1")?.depositRates?.["36_10000"]).toBe(480000);
    expect(draft.trims.find((trim) => trim.trimId === "t2")?.prepayRates?.["36_10000"]).toBe(610000);
    // 9개 키 모두 채워짐
    expect(Object.keys(draft.minBaseRates).sort()).toEqual([...RATE_KEYS].sort());
    // 보증금/선납금은 36_10000 외 셀은 0
    expect(draft.minDepositRates["48_20000"]).toBe(0);
    expect(draft.weekOf).toBe("2026-06-08");
    expect(draft.warnings).toHaveLength(0);
  });

  it("단일 트림이면 min===max", () => {
    const results: TrimScrapeResult[] = [
      {
        trimId: "t1",
        matchConfidence: "exact",
        externalTrimLabel: "A",
        vehiclePrice: 35000000,
        baseRates: fullBase(550000),
        warnings: [],
      },
    ];
    const draft = buildDraftFromTrimResults(results, params, "장기렌트", "2026-06-10T00:00:00.000Z");
    expect(draft.minVehiclePrice).toBe(35000000);
    expect(draft.maxVehiclePrice).toBe(35000000);
    expect(draft.minBaseRates).toEqual(draft.maxBaseRates);
  });

  it("매칭 실패 트림은 경고로만 남기고 값에 반영하지 않는다", () => {
    const results: TrimScrapeResult[] = [
      {
        trimId: "t1",
        matchConfidence: "exact",
        externalTrimLabel: "A",
        vehiclePrice: 33000000,
        baseRates: fullBase(500000),
        warnings: [],
      },
      {
        trimId: "t2",
        matchConfidence: "unmatched",
        externalTrimLabel: "수입 특별판",
        vehiclePrice: 0,
        baseRates: {},
        warnings: [],
      },
    ];
    const draft = buildDraftFromTrimResults(results, params, "장기렌트", "2026-06-10T00:00:00.000Z");
    expect(draft.minVehiclePrice).toBe(33000000);
    expect(draft.maxVehiclePrice).toBe(33000000);
    expect(draft.warnings.some((w) => w.includes("수입 특별판"))).toBe(true);
    expect(draft.trims).toHaveLength(2);
  });

  it("유효 견적이 전혀 없으면 빈 표 + 경고", () => {
    const results: TrimScrapeResult[] = [
      {
        trimId: "t1",
        matchConfidence: "unmatched",
        externalTrimLabel: "X",
        vehiclePrice: 0,
        baseRates: {},
        warnings: [],
      },
    ];
    const draft = buildDraftFromTrimResults(results, params, "리스", "2026-06-10T00:00:00.000Z");
    expect(draft.minBaseRates).toEqual(emptyRates());
    expect(draft.warnings.length).toBeGreaterThan(0);
    expect(draft.productType).toBe("리스");
  });
});
