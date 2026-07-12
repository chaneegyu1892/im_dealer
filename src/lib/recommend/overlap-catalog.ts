import {
  CATALOG_VEHICLES,
  EV_CHARGING_EVIDENCE,
  PDF_PLACEMENTS,
  type CatalogFacts,
  type CatalogVehicleSource,
  type EvChargingEvidence,
  type PdfPlacement,
} from "../../../prisma/recommendation-overlap-v2-data";
import {
  parseOverlapProfile,
  type OverlapProfile,
  type SuitabilityLevel,
} from "./overlap-profile";

interface MutableScores {
  industry: { 법인: SuitabilityLevel; 개인사업자: SuitabilityLevel; 개인: SuitabilityLevel };
  primaryPreference: { 안정감: SuitabilityLevel; 주차편의: SuitabilityLevel; 경제성: SuitabilityLevel; 고급: SuitabilityLevel };
  additionalCondition: {
    family: { default: SuitabilityLevel; details: { 영유아: SuitabilityLevel; 미취학: SuitabilityLevel; 초등: SuitabilityLevel; "중학생+": SuitabilityLevel } };
    cargo: { default: SuitabilityLevel; details: { "소형 박스": SuitabilityLevel; "대형 화물": SuitabilityLevel } };
  };
  annualMileage: { "10000": SuitabilityLevel; "20000": SuitabilityLevel; "30000": SuitabilityLevel };
  region: { 일반: SuitabilityLevel; "강원·산간": SuitabilityLevel; 제주: SuitabilityLevel };
}

export interface CompiledOverlapCatalogRow {
  readonly documentName: string;
  readonly slug: string;
  readonly activationIntent: "active";
  readonly facts: CatalogFacts;
  readonly chargingEvidence: EvChargingEvidence | null;
  readonly profile: OverlapProfile;
}

export class OverlapCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverlapCatalogError";
  }
}
export interface OverlapCatalogSources {
  readonly vehicles: readonly CatalogVehicleSource[];
  readonly placements: readonly PdfPlacement[];
  readonly chargingEvidence: readonly EvChargingEvidence[];
}
function emptyScores(): MutableScores {
  return {
    industry: { 법인: "none", 개인사업자: "none", 개인: "none" },
    primaryPreference: { 안정감: "none", 주차편의: "none", 경제성: "none", 고급: "none" },
    additionalCondition: {
      family: { default: "none", details: { 영유아: "none", 미취학: "none", 초등: "none", "중학생+": "none" } },
      cargo: { default: "none", details: { "소형 박스": "none", "대형 화물": "none" } },
    },
    annualMileage: { "10000": "none", "20000": "none", "30000": "none" },
    region: { 일반: "none", "강원·산간": "none", 제주: "none" },
  };
}
function applyPlacement(scores: MutableScores, placement: PdfPlacement): void {
  const level = placement.level;
  if (placement.axis === "industry") {
    if (placement.answer === "법인") scores.industry.법인 = level;
    else if (placement.answer === "개인사업자") scores.industry.개인사업자 = level;
    else if (placement.answer === "개인") scores.industry.개인 = level;
    else throw new OverlapCatalogError(`unknown industry answer: ${placement.answer}`);
    return;
  }
  if (placement.axis === "primaryPreference") {
    if (placement.answer === "안정감") scores.primaryPreference.안정감 = level;
    else if (placement.answer === "주차편의") scores.primaryPreference.주차편의 = level;
    else if (placement.answer === "경제성") scores.primaryPreference.경제성 = level;
    else if (placement.answer === "고급") scores.primaryPreference.고급 = level;
    else throw new OverlapCatalogError(`unknown primary answer: ${placement.answer}`);
    return;
  }
  if (placement.axis === "additionalCondition") {
    if (placement.answer === "가족") scores.additionalCondition.family.default = level;
    else if (placement.answer === "화물") scores.additionalCondition.cargo.default = level;
    else throw new OverlapCatalogError(`unknown condition answer: ${placement.answer}`);
    return;
  }
  if (placement.axis === "annualMileage") {
    if (placement.answer === "10000") scores.annualMileage["10000"] = level;
    else if (placement.answer === "20000") scores.annualMileage["20000"] = level;
    else if (placement.answer === "30000") scores.annualMileage["30000"] = level;
    else throw new OverlapCatalogError(`unknown mileage answer: ${placement.answer}`);
    return;
  }
  if (placement.answer === "일반") scores.region.일반 = level;
  else if (placement.answer === "강원·산간") scores.region["강원·산간"] = level;
  else if (placement.answer === "제주") scores.region.제주 = level;
  else throw new OverlapCatalogError(`unknown region answer: ${placement.answer}`);
}
function promote(level: SuitabilityLevel): SuitabilityLevel {
  if (level === "support") return "fit";
  if (level === "fit") return "best";
  return level;
}

function demote(level: SuitabilityLevel): SuitabilityLevel {
  if (level === "best") return "fit";
  if (level === "fit") return "support";
  if (level === "support") return "none";
  return "none";
}

function compileDetails(scores: MutableScores, facts: CatalogFacts): void {
  const family = scores.additionalCondition.family.default;
  if (family !== "none") {
    scores.additionalCondition.family.details.영유아 = facts.slidingDoor === true
      ? promote(family)
      : facts.bodyClass === "sedan" ? demote(family) : family;
    scores.additionalCondition.family.details.미취학 = facts.advancedSafety === true ? promote(family) : family;
    scores.additionalCondition.family.details.초등 = facts.seating !== null && facts.seating >= 7 ? promote(family) : family;
    scores.additionalCondition.family.details["중학생+"] = facts.bodyClass === "van"
      ? demote(family)
      : facts.bodyClass === "suv" || facts.bodyClass === "sedan" ? promote(family) : family;
  }

  const cargo = scores.additionalCondition.cargo.default;
  if (cargo !== "none") {
    scores.additionalCondition.cargo.details["소형 박스"] = facts.bodyClass === "van"
      ? promote(cargo)
      : facts.bodyClass === "sedan" ? demote(cargo) : cargo;
    const largeCargoFit = (facts.cargoKg !== null && facts.cargoKg >= 1_000)
      || facts.bodyClass === "van"
      || (facts.seating !== null && facts.seating >= 7);
    scores.additionalCondition.cargo.details["대형 화물"] = largeCargoFit ? promote(cargo) : facts.bodyClass === "sedan" ? demote(cargo) : cargo;
  }
}

export function deriveChargingFit(evidence: EvChargingEvidence): {
  readonly 자택: SuitabilityLevel;
  readonly 직장: SuitabilityLevel;
  readonly 외부: SuitabilityLevel;
  readonly 없음: SuitabilityLevel;
} {
  const ac: SuitabilityLevel = evidence.acChargingKw >= 11
    ? "best"
    : evidence.acChargingKw >= 7 ? "fit" : evidence.acChargingKw > 0 ? "support" : "none";
  const hasDc = (evidence.dcPeakKw !== null && evidence.dcPeakKw > 0)
    || evidence.dcTenToEightyMinutes !== null;
  const external: SuitabilityLevel = (evidence.dcTenToEightyMinutes !== null && evidence.dcTenToEightyMinutes <= 25)
    || (evidence.dcPeakKw !== null && evidence.dcPeakKw >= 180)
    ? "best"
    : (evidence.dcTenToEightyMinutes !== null && evidence.dcTenToEightyMinutes <= 35)
      || (evidence.dcPeakKw !== null && evidence.dcPeakKw >= 100)
      ? "fit"
      : hasDc ? "support" : "none";
  const noCharger: SuitabilityLevel = evidence.certifiedCombinedRangeKm >= 500
    ? "best"
    : evidence.certifiedCombinedRangeKm >= 400
      ? "fit"
      : evidence.certifiedCombinedRangeKm >= 300 ? "support" : "none";
  return { 자택: ac, 직장: ac, 외부: external, 없음: noCharger };
}

function assertSourceIntegrity(sources: OverlapCatalogSources): void {
  const names = new Set<string>();
  const slugs = new Set<string>();
  for (const vehicle of sources.vehicles) {
    if (names.has(vehicle.documentName)) throw new OverlapCatalogError(`duplicate documentName: ${vehicle.documentName}`);
    if (slugs.has(vehicle.slug)) throw new OverlapCatalogError(`duplicate slug: ${vehicle.slug}`);
    names.add(vehicle.documentName);
    slugs.add(vehicle.slug);
  }
  const placements = new Set<string>();
  for (const row of sources.placements) {
    if (row.vehicles.length < 3 || row.vehicles.length > 4) throw new OverlapCatalogError(`invalid level size: ${row.axis}/${row.answer}/${row.level}`);
    for (const documentName of row.vehicles) {
      if (!names.has(documentName)) throw new OverlapCatalogError(`placement without vehicle: ${documentName}`);
      const key = `${row.axis}/${row.answer}/${documentName}`;
      if (placements.has(key)) throw new OverlapCatalogError(`cross-level duplicate: ${key}`);
      placements.add(key);
    }
  }
}

export function compileOverlapCatalog(): readonly CompiledOverlapCatalogRow[] {
  return compileOverlapCatalogFromSources({
    vehicles: CATALOG_VEHICLES,
    placements: PDF_PLACEMENTS,
    chargingEvidence: EV_CHARGING_EVIDENCE,
  });
}

export function compileOverlapCatalogFromSources(
  sources: OverlapCatalogSources
): readonly CompiledOverlapCatalogRow[] {
  assertSourceIntegrity(sources);
  const evidenceByName = new Map(sources.chargingEvidence.map((row) => [row.documentName, row]));
  const rows: CompiledOverlapCatalogRow[] = [];

  for (const vehicle of sources.vehicles) {
    const scores = emptyScores();
    for (const placement of sources.placements) {
      if (placement.vehicles.includes(vehicle.documentName)) applyPlacement(scores, placement);
    }
    compileDetails(scores, vehicle.facts);
    const chargingEvidence = evidenceByName.get(vehicle.documentName) ?? null;
    if (vehicle.fuelGroup === "EV" && chargingEvidence === null) {
      throw new OverlapCatalogError(`missing EV charging evidence: ${vehicle.documentName}`);
    }
    if (vehicle.fuelGroup !== "EV" && chargingEvidence !== null) {
      throw new OverlapCatalogError(`non-EV charging evidence: ${vehicle.documentName}`);
    }
    const candidate = vehicle.fuelGroup === "EV" && chargingEvidence !== null
      ? { version: "overlap-v2", fuelGroup: "EV", scores, chargingFit: deriveChargingFit(chargingEvidence), companyPriority: 0, profitPriority: 0 }
      : { version: "overlap-v2", fuelGroup: vehicle.fuelGroup, scores, companyPriority: 0, profitPriority: 0 };
    const parsed = parseOverlapProfile(candidate);
    if (parsed.kind !== "valid") throw new OverlapCatalogError(`invalid compiled profile: ${vehicle.documentName}`);
    rows.push({
      documentName: vehicle.documentName,
      slug: vehicle.slug,
      activationIntent: vehicle.activationIntent,
      facts: vehicle.facts,
      chargingEvidence,
      profile: parsed.profile,
    });
  }

  return rows.sort((left, right) => left.slug.localeCompare(right.slug));
}

export function catalogPlacementsCsv(catalog: readonly CompiledOverlapCatalogRow[]): string {
  const slugByName = new Map(catalog.map((row) => [row.documentName, row.slug]));
  const lines = ["axis,answer,level,documentName,slug"];
  for (const placement of PDF_PLACEMENTS) {
    for (const documentName of placement.vehicles) {
      const slug = slugByName.get(documentName);
      if (slug === undefined) throw new OverlapCatalogError(`missing catalog row for CSV: ${documentName}`);
      lines.push([placement.axis, placement.answer, placement.level, documentName, slug].join(","));
    }
  }
  return `${lines.slice(0, 1).concat(lines.slice(1).sort()).join("\n")}\n`;
}

export function verifyCatalogVehicleIdentities(
  catalog: readonly CompiledOverlapCatalogRow[],
  databaseVehicles: readonly { readonly slug: string; readonly name: string }[]
): void {
  const bySlug = new Map(databaseVehicles.map((vehicle) => [vehicle.slug, vehicle.name]));
  for (const row of catalog) {
    const actualName = bySlug.get(row.slug);
    if (actualName === undefined) throw new OverlapCatalogError(`missing database slug: ${row.slug}`);
    if (actualName !== row.documentName) {
      throw new OverlapCatalogError(`database name mismatch: ${row.slug} expected=${row.documentName} actual=${actualName}`);
    }
  }
}
