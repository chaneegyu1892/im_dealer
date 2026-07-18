import { describe, expect, it } from "vitest";
import rawSnapshot from "./data/newcar-popularity-2026-05.json";
import {
  MAY_2026_POPULARITY,
  POPULARITY_SLUG_MAPPING,
  parsePopularitySnapshot,
} from "./popularity-snapshot";

const EXPECTED_SLUGS = [
  "tesla-11738",
  "kia-11573",
  "hyundai-11462",
  "kia-11606",
  "hyundai-11414",
  "hyundai-10014",
  "kia-11722",
  "kia-11116",
  "kia-11681",
  "kia-11562",
  "kia-11818",
  "hyundai-11576",
  "hyundai-11664",
  "hyundai-11294",
  "kia-11792",
  "bmw-11584",
  "kia-10047",
  "kia-11844",
  "genesis-11644",
  "kia-11597",
  "hyundai-11260",
  "hyundai-11396",
  "genesis-10534",
  "renault-11842",
  "hyundai-11609",
  "hyundai-11744",
  "tesla-11670",
  "benz-11651",
  "genesis-11593",
  "kia-11760",
] as const;

describe("May 2026 popularity snapshot", () => {
  it("parses exactly 30 contiguous unique ranks for the fixed period", () => {
    expect(MAY_2026_POPULARITY.period).toBe("2026-05");
    expect(MAY_2026_POPULARITY.entries).toHaveLength(30);
    expect(MAY_2026_POPULARITY.entries.map((entry) => entry.rank)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1)
    );
  });

  it("resolves every source rank to the approved exact slug mapping", () => {
    expect(MAY_2026_POPULARITY.entries.map((entry) => entry.slug)).toEqual(
      EXPECTED_SLUGS
    );
    expect(MAY_2026_POPULARITY.entries[0]?.slug).toBe("tesla-11738");
    expect(MAY_2026_POPULARITY.entries[14]?.slug).toBe("kia-11792");
    expect(MAY_2026_POPULARITY.entries[29]?.slug).toBe("kia-11760");
  });

  it.each([
    [
      "declared count",
      { ...rawSnapshot, count: 29 },
    ],
    [
      "wrong period",
      { ...rawSnapshot, basis: rawSnapshot.basis.replace("2026년 05월", "2026년 04월") },
    ],
    [
      "missing rank",
      { ...rawSnapshot, vehicles: rawSnapshot.vehicles.slice(0, -1) },
    ],
    [
      "duplicate rank",
      {
        ...rawSnapshot,
        vehicles: rawSnapshot.vehicles.map((row, index) =>
          index === 29 ? { ...row, rank: 1 } : row
        ),
      },
    ],
    [
      "invalid registration count",
      {
        ...rawSnapshot,
        vehicles: rawSnapshot.vehicles.map((row, index) =>
          index === 0 ? { ...row, registration_count: -1 } : row
        ),
      },
    ],
  ])("rejects malformed source data: %s", (_label, value) => {
    expect(() => parsePopularitySnapshot(value, POPULARITY_SLUG_MAPPING))
      .toThrow();
  });

  it("rejects a missing mapping disposition", () => {
    expect(() =>
      parsePopularitySnapshot(rawSnapshot, POPULARITY_SLUG_MAPPING.slice(0, -1))
    ).toThrow();
  });

  it("rejects a duplicate mapped slug", () => {
    const duplicateSlugMapping = POPULARITY_SLUG_MAPPING.map((entry, index) =>
      index === 29 ? { ...entry, slug: "tesla-11738" } : entry
    );

    expect(() =>
      parsePopularitySnapshot(rawSnapshot, duplicateSlugMapping)
    ).toThrow();
  });
});
