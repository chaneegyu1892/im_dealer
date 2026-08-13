import { describe, expect, it } from "vitest";
import { readSnapshotTrimPricing } from "./quote-snapshot-pricing";

describe("readSnapshotTrimPricing", () => {
  it("prefers explicitly stored list and discount prices over derived values", () => {
    expect(readSnapshotTrimPricing({
      trimPrice: 50_000_000,
      discountPrice: 45_000_000,
      optionsTotalPrice: 1_000_000,
      colorDelta: 0,
      totalVehiclePrice: 46_000_000,
    })).toEqual({
      trimPrice: 50_000_000,
      discountPrice: 45_000_000,
      source: "snapshot",
    });
  });

  it("keeps an explicit null discount instead of treating it as missing", () => {
    expect(readSnapshotTrimPricing({
      trimPrice: 40_000_000,
      discountPrice: null,
      totalVehiclePrice: 41_000_000,
      optionsTotalPrice: 1_000_000,
      colorDelta: 0,
    })).toEqual({
      trimPrice: 40_000_000,
      discountPrice: null,
      source: "snapshot",
    });
  });

  it("derives the discounted trim price from total vehicle price for legacy quotes", () => {
    expect(readSnapshotTrimPricing({
      trimPrice: 50_000_000,
      optionsTotalPrice: 1_000_000,
      colorDelta: 200_000,
      totalVehiclePrice: 46_200_000,
    })).toEqual({
      trimPrice: 50_000_000,
      discountPrice: 45_000_000,
      source: "derived",
    });
  });

  it("returns none when breakdown has no usable price fields", () => {
    expect(readSnapshotTrimPricing({ productType: "장기렌트" })).toEqual({
      trimPrice: null,
      discountPrice: null,
      source: "none",
    });
  });
});
