import { describe, expect, it } from "vitest";
import {
  EXCLUDED_RECOMMENDATION_VEHICLES,
  getRecommendationExclusion,
  isExcludedRecommendationTrim,
} from "./excluded-vehicles";

describe("recommendation commercial exclusions", () => {
  it("contains the PDF's exact 15 stable slugs", () => {
    expect(EXCLUDED_RECOMMENDATION_VEHICLES).toHaveLength(15);
    expect(new Set(EXCLUDED_RECOMMENDATION_VEHICLES.map((item) => item.slug)).size).toBe(15);
  });

  it.each(EXCLUDED_RECOMMENDATION_VEHICLES)("always excludes $documentName", (item) => {
    expect(getRecommendationExclusion({ slug: item.slug, category: "승용" })).toEqual({
      kind: "document_slug",
      documentName: item.documentName,
    });
  });

  it("uses truck category only as defense in depth", () => {
    expect(getRecommendationExclusion({ slug: "future-truck", category: "트럭" })).toEqual({
      kind: "truck_category",
      documentName: null,
    });
    expect(getRecommendationExclusion({ slug: "passenger-suv", category: "SUV" })).toBeNull();
  });

  it.each(["더 뉴 EV6 GT", "아이오닉 5 N", "e-tron GT"])(
    "excludes performance vehicle name %s",
    (name) => {
      expect(getRecommendationExclusion({ slug: "performance", category: "승용", name }))
        .toEqual({ kind: "vehicle_variant", documentName: name });
    }
  );

  it("does not confuse longer model tokens with GT or N variants", () => {
    expect(getRecommendationExclusion({ slug: "gti", category: "승용", name: "Golf GTI" })).toBeNull();
    expect(getRecommendationExclusion({ slug: "gtb", category: "승용", name: "296 GTB" })).toBeNull();
  });

  it.each([
    ["GT", "2027년형"],
    ["프레스티지", "2027년형 N Line"],
    ["캘리그래피 블랙 잉크", "2027년형"],
  ])("excludes special trim %s / %s", (name, lineupName) => {
    expect(isExcludedRecommendationTrim({ name, lineup: { name: lineupName } })).toBe(true);
  });
});
