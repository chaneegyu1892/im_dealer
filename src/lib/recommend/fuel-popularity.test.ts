import { describe, expect, it } from "vitest";
import {
  createFuelPopularityEvidenceLookup,
  getNiceFuelTypesForPreference,
  parseStoredFuelPopularitySnapshot,
  rankFuelPopularityEntries,
  STORED_FUEL_POPULARITY_VERSION,
  type StoredFuelPopularityBatch,
} from "./fuel-popularity";
import {
  NICE_POPULARITY_COUNT,
  NICE_POPULARITY_FUEL_TYPES,
} from "./nice-popularity";

const registrationBase = {
  gasoline: 40_000,
  diesel: 30_000,
  hybrid: 20_000,
  electric: 10_000,
} as const;

function storedBatch(): StoredFuelPopularityBatch {
  return {
    version: STORED_FUEL_POPULARITY_VERSION,
    entries: NICE_POPULARITY_FUEL_TYPES.flatMap((fuelType) =>
      Array.from({ length: NICE_POPULARITY_COUNT }, (_, index) => ({
        fuelType,
        rank: index + 1,
        brand: "테스트",
        model: `${fuelType}-${index + 1}`,
        registrationCount: registrationBase[fuelType] - index,
        sharePct: 0.01,
        momPct: 0,
        vehicleSlug: `${fuelType}-${index + 1}`,
      }))
    ),
  };
}

describe("연료별 NICE 인기 스냅샷", () => {
  it("네 연료의 1~30위 총 120개를 하나의 월 배치로 검증한다", () => {
    const parsed = parseStoredFuelPopularitySnapshot("2026-06", storedBatch());

    expect(parsed?.entries).toHaveLength(120);
    expect(parsed?.entries.filter((entry) => entry.fuelType === "gasoline")).toHaveLength(30);
    expect(parsed?.entries.filter((entry) => entry.fuelType === "electric")).toHaveLength(30);
  });

  it("한 연료라도 30위가 끊기면 월 배치 전체를 거부한다", () => {
    const missing = storedBatch();
    missing.entries = missing.entries.slice(0, -1);
    expect(parseStoredFuelPopularitySnapshot("2026-06", missing)).toBeNull();

    const duplicateRank = storedBatch();
    duplicateRank.entries[119] = { ...duplicateRank.entries[119]!, rank: 1 };
    expect(parseStoredFuelPopularitySnapshot("2026-06", duplicateRank)).toBeNull();
  });

  it("AI 답변을 지원하는 NICE 연료 목록으로 정확히 변환한다", () => {
    expect(getNiceFuelTypesForPreference("가솔린/디젤")).toEqual(["gasoline", "diesel"]);
    expect(getNiceFuelTypesForPreference("하이브리드")).toEqual(["hybrid"]);
    expect(getNiceFuelTypesForPreference("전기차")).toEqual(["electric"]);
    expect(getNiceFuelTypesForPreference("상관없음")).toEqual([
      "gasoline",
      "diesel",
      "hybrid",
      "electric",
    ]);
  });

  it("선택 답변별 후보 순위를 최대 60/30/30/120개로 만든다", () => {
    const snapshot = parseStoredFuelPopularitySnapshot("2026-06", storedBatch());
    expect(snapshot).not.toBeNull();

    expect(rankFuelPopularityEntries(snapshot!, "가솔린/디젤")).toHaveLength(60);
    expect(rankFuelPopularityEntries(snapshot!, "하이브리드")).toHaveLength(30);
    expect(rankFuelPopularityEntries(snapshot!, "전기차")).toHaveLength(30);
    expect(rankFuelPopularityEntries(snapshot!, "상관없음")).toHaveLength(120);
  });

  it("여러 연료 목록은 등록대수로 합치고 같은 차량은 가장 큰 항목만 유지한다", () => {
    const batch = storedBatch();
    batch.entries[30] = {
      ...batch.entries[30]!,
      vehicleSlug: "gasoline-1",
      registrationCount: 50_000,
    };
    const snapshot = parseStoredFuelPopularitySnapshot("2026-06", batch);
    expect(snapshot).not.toBeNull();

    const ranked = rankFuelPopularityEntries(snapshot!, "가솔린/디젤");
    expect(ranked).toHaveLength(59);
    expect(ranked[0]).toMatchObject({
      slug: "gasoline-1",
      registrationCount: 50_000,
      sourceFuelType: "diesel",
      sourceRank: 1,
    });

    const lookup = createFuelPopularityEvidenceLookup(snapshot!, "가솔린/디젤");
    expect(lookup("gasoline-1")).toEqual({
      period: "2026-06",
      rank: 1,
      registrationCount: 50_000,
    });
    expect(lookup("hybrid-1").rank).toBeNull();
  });
});
