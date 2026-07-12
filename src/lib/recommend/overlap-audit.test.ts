import { describe, expect, it } from "vitest";
import { compileOverlapCatalog } from "./overlap-catalog";
import { auditOverlapSnapshot } from "./overlap-audit";
import type { OverlapCandidateSnapshot, OverlapRuntimeVehicle } from "./overlap-candidate-loader";
import type { OverlapScoringInput } from "./overlap-scoring";

const input: OverlapScoringInput = {
  industry: "개인",
  industryDetail: "혼자",
  annualMileage: 20_000,
  residenceRegion: "일반",
  fuelPreference: "상관없음",
};

function vehicle(slug: string, profile: unknown): OverlapRuntimeVehicle {
  return {
    vehicleId: slug,
    slug,
    brand: "테스트",
    name: slug,
    category: "SUV",
    isVisible: true,
    config: { isActive: true, profile },
    trims: [],
    surchargeRate: 0,
    isPopular: false,
    thumbnailUrl: "",
    imageUrls: [],
    highlights: [],
    popularConfigs: [],
  };
}

describe("auditOverlapSnapshot", () => {
  it("emits explicit readiness failures without writing or user/session data", () => {
    const profile = compileOverlapCatalog()[0]?.profile;
    expect(profile).toBeDefined();
    const snapshot: OverlapCandidateSnapshot = {
      vehicles: [vehicle("kia-11792", profile)],
      rankSurchargeRates: [1, 1.5, 2, 2.5],
    };
    const report = auditOverlapSnapshot(snapshot, [input]);
    expect(report.passed).toBe(false);
    expect(report.configuredProfileCount).toBe(1);
    expect(report.activeExcludedConfigCount).toBe(1);
    expect(report.failures).toContain("configured_profile_count");
    expect(report.failures).toContain("excluded_config_active");
    expect(JSON.stringify(report)).not.toMatch(/session|userAgent|email/i);
  });

  it("detects invalid profiles as unready while remaining deterministic", () => {
    const report = auditOverlapSnapshot({
      vehicles: [vehicle("invalid", { version: "overlap-v2" })],
      rankSurchargeRates: [1, 1.5, 2, 2.5],
    }, [input]);
    expect(report.deterministic).toBe(true);
    expect(report.operationalFidelity).toBe(true);
    expect(report.failures).toContain("configured_profile_count");
  });
});
