import { describe, expect, it } from "vitest";
import { compileOverlapCatalog } from "../src/lib/recommend/overlap-catalog";
import {
  decideProfileBootstrapAction,
  getRecommendationDatabaseFingerprint,
} from "./recommendation-overlap-v2-bootstrap";

describe("recommendation overlap v2 bootstrap", () => {
  it("preserves valid v2 profiles and migrates only missing/legacy/invalid rows", () => {
    const profile = compileOverlapCatalog()[0]?.profile;
    expect(profile).toBeDefined();
    if (!profile) return;
    expect(decideProfileBootstrapAction(null, false)).toBe("create");
    expect(decideProfileBootstrapAction({ industry: { 법인: 1 } }, false)).toBe("migrate");
    expect(decideProfileBootstrapAction({ ...profile, scores: {} }, false)).toBe("migrate");
    expect(decideProfileBootstrapAction(profile, false)).toBe("preserve");
    expect(decideProfileBootstrapAction(profile, true)).toBe("reset");
  });

  it("fingerprints only the database endpoint identity, never credentials", () => {
    const first = getRecommendationDatabaseFingerprint("postgresql://user:secret@example.com:5432/app?schema=public");
    const second = getRecommendationDatabaseFingerprint("postgresql://other:different@example.com:5432/app?schema=public");
    const otherSchema = getRecommendationDatabaseFingerprint("postgresql://user:secret@example.com:5432/app?schema=test");
    expect(first).toBe(second);
    expect(first).not.toBe(otherSchema);
    expect(first).not.toContain("secret");
  });
});
