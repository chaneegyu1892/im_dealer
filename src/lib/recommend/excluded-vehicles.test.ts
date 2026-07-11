import { describe, expect, it } from "vitest";
import {
  EXCLUDED_RECOMMENDATION_VEHICLES,
  getRecommendationExclusion,
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
});
