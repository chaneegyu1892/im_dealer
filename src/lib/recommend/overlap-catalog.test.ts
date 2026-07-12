import { describe, expect, it } from "vitest";
import {
  CATALOG_VEHICLES,
  EV_CHARGING_EVIDENCE,
  PDF_PLACEMENTS,
  type PdfPlacement,
} from "../../../prisma/recommendation-overlap-v2-data";
import {
  GOLDEN_COUNTS,
  GOLDEN_DETAIL_EXPECTATIONS,
  GOLDEN_PDF_PLACEMENTS,
} from "./__fixtures__/overlap-pdf-golden";
import { EXCLUDED_RECOMMENDATION_VEHICLES } from "./excluded-vehicles";
import {
  catalogPlacementsCsv,
  compileOverlapCatalog,
  compileOverlapCatalogFromSources,
  deriveChargingFit,
  verifyCatalogVehicleIdentities,
} from "./overlap-catalog";
import { parseOverlapProfile, type OverlapProfile, type SuitabilityLevel } from "./overlap-profile";

function canonicalPlacement(row: {
  readonly axis: string;
  readonly answer: string;
  readonly level: string;
  readonly vehicles?: readonly string[];
  readonly documentNames?: readonly string[];
}): string {
  return [row.axis, row.answer, row.level, ...(row.vehicles ?? row.documentNames ?? []).slice().sort()].join("|");
}

function placementLevel(profile: OverlapProfile, row: PdfPlacement): SuitabilityLevel {
  if (row.axis === "industry") {
    if (row.answer === "법인") return profile.scores.industry.법인;
    if (row.answer === "개인사업자") return profile.scores.industry.개인사업자;
    if (row.answer === "개인") return profile.scores.industry.개인;
  }
  if (row.axis === "primaryPreference") {
    if (row.answer === "안정감") return profile.scores.primaryPreference.안정감;
    if (row.answer === "주차편의") return profile.scores.primaryPreference.주차편의;
    if (row.answer === "경제성") return profile.scores.primaryPreference.경제성;
    if (row.answer === "고급") return profile.scores.primaryPreference.고급;
  }
  if (row.axis === "additionalCondition") {
    if (row.answer === "가족") return profile.scores.additionalCondition.family.default;
    if (row.answer === "화물") return profile.scores.additionalCondition.cargo.default;
  }
  if (row.axis === "annualMileage") {
    if (row.answer === "10000") return profile.scores.annualMileage["10000"];
    if (row.answer === "20000") return profile.scores.annualMileage["20000"];
    if (row.answer === "30000") return profile.scores.annualMileage["30000"];
  }
  if (row.axis === "region") {
    if (row.answer === "일반") return profile.scores.region.일반;
    if (row.answer === "강원·산간") return profile.scores.region["강원·산간"];
    if (row.answer === "제주") return profile.scores.region.제주;
  }
  throw new Error(`invalid placement ${row.axis}/${row.answer}`);
}

const levelIndex = (level: SuitabilityLevel): number => {
  if (level === "none") return 0;
  if (level === "support") return 1;
  if (level === "fit") return 2;
  return 3;
};

describe("overlap PDF catalog", () => {
  it("matches the independent 45-level, 150-placement, 51-vehicle golden fixture", () => {
    const source = PDF_PLACEMENTS.map(canonicalPlacement).sort();
    const golden = GOLDEN_PDF_PLACEMENTS.map(canonicalPlacement).sort();
    const placementCount = GOLDEN_PDF_PLACEMENTS.reduce((sum, row) => sum + row.documentNames.length, 0);
    const uniqueNames = new Set(GOLDEN_PDF_PLACEMENTS.flatMap((row) => row.documentNames));

    expect(source).toEqual(golden);
    expect(GOLDEN_PDF_PLACEMENTS).toHaveLength(GOLDEN_COUNTS.levels);
    expect(placementCount).toBe(GOLDEN_COUNTS.placements);
    expect(uniqueNames.size).toBe(GOLDEN_COUNTS.vehicles);
    expect(GOLDEN_PDF_PLACEMENTS.every((row) => row.documentNames.length >= 3 && row.documentNames.length <= 4)).toBe(true);
  });

  it("compiles 51 strict profiles and preserves every PDF membership", () => {
    const catalog = compileOverlapCatalog();
    expect(catalog).toHaveLength(51);
    expect(new Set(catalog.map((row) => row.slug)).size).toBe(51);
    expect(catalog.every((row) => parseOverlapProfile(row.profile).kind === "valid")).toBe(true);

    for (const placement of PDF_PLACEMENTS) {
      for (const documentName of placement.vehicles) {
        const row = catalog.find((candidate) => candidate.documentName === documentName);
        expect(row, documentName).toBeDefined();
        if (row) expect(placementLevel(row.profile, placement)).toBe(placement.level);
      }
    }
  });

  it("keeps all three Seltos documents on distinct slugs", () => {
    const seltos = compileOverlapCatalog().filter((row) => row.documentName.includes("셀토스"));
    expect(seltos.map((row) => [row.documentName, row.slug]).sort()).toEqual([
      ["더 뉴 셀토스", "kia-11104"],
      ["디 올 뉴 셀토스 HEV", "kia-11845"],
      ["디 올 뉴 셀토스", "kia-11844"],
    ]);
  });

  it("matches the independently reviewed child and cargo detail maps", () => {
    const catalog = compileOverlapCatalog();
    for (const expected of GOLDEN_DETAIL_EXPECTATIONS) {
      const row = catalog.find((candidate) => candidate.documentName === expected.documentName);
      expect(row, expected.documentName).toBeDefined();
      if (!row) continue;
      if (expected.family) {
        const family = row.profile.scores.additionalCondition.family;
        expect([family.default, family.details.영유아, family.details.미취학, family.details.초등, family.details["중학생+"]]).toEqual(expected.family);
      }
      if (expected.cargo) {
        const cargo = row.profile.scores.additionalCondition.cargo;
        expect([cargo.default, cargo.details["소형 박스"], cargo.details["대형 화물"]]).toEqual(expected.cargo);
      }
    }
  });

  it("never promotes a parent none and moves listed details by at most one tier", () => {
    for (const row of compileOverlapCatalog()) {
      const family = row.profile.scores.additionalCondition.family;
      const cargo = row.profile.scores.additionalCondition.cargo;
      for (const detail of Object.values(family.details)) {
        if (family.default === "none") expect(detail).toBe("none");
        expect(Math.abs(levelIndex(detail) - levelIndex(family.default))).toBeLessThanOrEqual(1);
      }
      for (const detail of Object.values(cargo.details)) {
        if (cargo.default === "none") expect(detail).toBe("none");
        expect(Math.abs(levelIndex(detail) - levelIndex(cargo.default))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("derives all 11 EV charging maps only from complete official evidence", () => {
    const catalog = compileOverlapCatalog();
    const evs = catalog.filter((row) => row.profile.fuelGroup === "EV");
    expect(evs).toHaveLength(GOLDEN_COUNTS.evs);
    expect(EV_CHARGING_EVIDENCE).toHaveLength(GOLDEN_COUNTS.evs);
    for (const row of evs) {
      expect(row.chargingEvidence).not.toBeNull();
      if (row.chargingEvidence && row.profile.fuelGroup === "EV") {
        expect(row.profile.chargingFit).toEqual(deriveChargingFit(row.chargingEvidence));
        expect(row.chargingEvidence.sourceUrl).toMatch(/^https:\/\//);
        expect(row.chargingEvidence.certifiedCombinedRangeKm).toBeGreaterThan(0);
        expect(row.chargingEvidence.acChargingKw).toBeGreaterThan(0);
      }
    }
    expect(catalog.filter((row) => row.profile.fuelGroup !== "EV").every((row) => row.chargingEvidence === null)).toBe(true);
    const ev3 = evs.find((row) => row.documentName === "더 EV3");
    expect(ev3?.profile.fuelGroup === "EV" ? ev3.profile.chargingFit : null).not.toEqual({ 자택: "none", 직장: "none", 외부: "none", 없음: "best" });
  });

  it("omits every commercial/special exclusion", () => {
    const slugs = new Set(compileOverlapCatalog().map((row) => row.slug));
    expect(EXCLUDED_RECOMMENDATION_VEHICLES).toHaveLength(15);
    expect(EXCLUDED_RECOMMENDATION_VEHICLES.every((row) => !slugs.has(row.slug))).toBe(true);
  });

  it("rejects duplicate slugs, cross-level duplicates, and missing EV evidence", () => {
    const first = CATALOG_VEHICLES[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(() => compileOverlapCatalogFromSources({
      vehicles: [...CATALOG_VEHICLES, { ...first, documentName: "중복 차량" }],
      placements: PDF_PLACEMENTS,
      chargingEvidence: EV_CHARGING_EVIDENCE,
    })).toThrow(/duplicate slug/);

    expect(() => compileOverlapCatalogFromSources({
      vehicles: CATALOG_VEHICLES,
      placements: [...PDF_PLACEMENTS, { axis: "industry", answer: "법인", level: "support", vehicles: ["디 올 뉴 G80 F/L", "더 뉴 그랜저 HEV", "The New K8 HEV"] }],
      chargingEvidence: EV_CHARGING_EVIDENCE,
    })).toThrow(/cross-level duplicate/);

    expect(() => compileOverlapCatalogFromSources({
      vehicles: CATALOG_VEHICLES,
      placements: PDF_PLACEMENTS,
      chargingEvidence: EV_CHARGING_EVIDENCE.filter((row) => row.documentName !== "Electrified G80 F/L"),
    })).toThrow(/missing EV charging evidence: Electrified G80 F\/L/);
  });

  it("verifies exact database slug/name identity and emits a stable 150-row CSV", () => {
    const catalog = compileOverlapCatalog();
    const databaseVehicles = catalog.map((row) => ({ slug: row.slug, name: row.documentName }));
    expect(() => verifyCatalogVehicleIdentities(catalog, databaseVehicles)).not.toThrow();
    expect(() => verifyCatalogVehicleIdentities(catalog, databaseVehicles.map((row) => row.slug === "genesis-11708" ? { ...row, name: "wrong" } : row))).toThrow(/database name mismatch/);
    expect(catalogPlacementsCsv(catalog).trim().split("\n")).toHaveLength(151);
  });
});
