import { EXCLUDED_RECOMMENDATION_VEHICLES } from "./excluded-vehicles";
import { assessOperationalEligibility } from "./operational-eligibility";
import type { OverlapCandidateSnapshot } from "./overlap-candidate-loader";
import { generateOverlapAuditInputs } from "./overlap-audit-matrix";
import { requiredFuelGroup } from "./overlap-ranking";
import { parseOverlapProfile, type FuelGroup } from "./overlap-profile";
import { recommendOverlapV2FromSnapshot } from "./recommend-overlap-v2";
import type { OverlapScoringInput } from "./overlap-scoring";

interface DiversityResult {
  readonly eligibleVehicles: number;
  readonly totalRankOneStates: number;
  readonly distinctRankOneVehicles: number;
  readonly maxRankOneShare: number;
  readonly passed: boolean;
  readonly distribution: readonly { readonly slug: string; readonly count: number }[];
}

export interface OverlapAuditReport {
  readonly version: "overlap-v2-audit";
  readonly stateCount: number;
  readonly catalog: { readonly levels: 45; readonly placements: 150; readonly vehicles: 51; readonly evs: 11; readonly exclusions: 15 };
  readonly configuredProfileCount: number;
  readonly activeExcludedConfigCount: number;
  readonly deterministic: boolean;
  readonly scoreBounds: boolean;
  readonly fuelFidelity: boolean;
  readonly operationalFidelity: boolean;
  readonly industryDetailInvariant: boolean;
  readonly childDetailSensitive: Readonly<Record<string, boolean>>;
  readonly cargoDetailSensitive: Readonly<Record<string, boolean>>;
  readonly chargingEnvironmentsObserved: readonly string[];
  readonly externalVsNoChargingSensitive: boolean;
  readonly diversity: Readonly<Record<FuelGroup, DiversityResult>>;
  readonly failures: readonly string[];
  readonly passed: boolean;
}

const resultSignature = (vehicles: readonly { readonly vehicle: { readonly slug: string }; readonly documentScore: number; readonly chargingAdjustment: number }[]) =>
  vehicles.map((vehicle) => `${vehicle.vehicle.slug}:${vehicle.documentScore}:${vehicle.chargingAdjustment}`).join("|");
const orderSignature = (vehicles: readonly { readonly vehicle: { readonly slug: string } }[]) =>
  vehicles.map((vehicle) => vehicle.vehicle.slug).join("|");

function comparisonKey(input: OverlapScoringInput, omit: "industryDetail" | "childDetail" | "cargoDetail" | "chargingEnvironment"): string {
  const entries = Object.entries(input).filter(([key]) => key !== omit).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(entries);
}

function updateVariantGroup(
  groups: Map<string, Map<string, string>>,
  key: string,
  variant: string,
  signature: string
): void {
  const variants = groups.get(key) ?? new Map<string, string>();
  variants.set(variant, signature);
  groups.set(key, variants);
}

function sensitivity(groups: Map<string, Map<string, string>>, variants: readonly string[]): Record<string, boolean> {
  const result = Object.fromEntries(variants.map((variant) => [variant, false]));
  for (const group of groups.values()) {
    if (new Set(group.values()).size < 2) continue;
    for (const variant of group.keys()) result[variant] = true;
  }
  return result;
}

function diversityResult(
  eligibleVehicles: number,
  counts: Map<string, number>
): DiversityResult {
  const distribution = [...counts.entries()].map(([slug, count]) => ({ slug, count }))
    .sort((left, right) => right.count - left.count || left.slug.localeCompare(right.slug));
  const total = distribution.reduce((sum, row) => sum + row.count, 0);
  const maxShare = total === 0 ? 0 : (distribution[0]?.count ?? 0) / total;
  const passed = eligibleVehicles < 3 || (distribution.length >= 3 && maxShare <= 0.5);
  return { eligibleVehicles, totalRankOneStates: total, distinctRankOneVehicles: distribution.length, maxRankOneShare: maxShare, passed, distribution };
}

export function auditOverlapSnapshot(
  snapshot: OverlapCandidateSnapshot,
  inputs: readonly OverlapScoringInput[] = generateOverlapAuditInputs()
): OverlapAuditReport {
  const failures = new Set<string>();
  const vehicleById = new Map(snapshot.vehicles.map((vehicle) => [vehicle.vehicleId, vehicle]));
  const excludedSlugs = new Set(EXCLUDED_RECOMMENDATION_VEHICLES.map((vehicle) => vehicle.slug));
  const configuredProfiles = snapshot.vehicles.filter((vehicle) => {
    const parsed = vehicle.config ? parseOverlapProfile(vehicle.config.profile) : null;
    return vehicle.config?.isActive === true && parsed?.kind === "valid";
  });
  const activeExcludedConfigCount = configuredProfiles.filter((vehicle) => excludedSlugs.has(vehicle.slug) || vehicle.category === "트럭").length;
  if (configuredProfiles.length !== 51) failures.add("configured_profile_count");
  if (activeExcludedConfigCount > 0) failures.add("excluded_config_active");

  const eligibleByFuel: Record<FuelGroup, Set<string>> = { EV: new Set(), HEV: new Set(), ICE: new Set() };
  for (const vehicle of snapshot.vehicles) for (const mileage of [10_000, 20_000, 30_000] as const) {
    const eligibility = assessOperationalEligibility(vehicle, mileage);
    if (eligibility.status === "eligible") eligibleByFuel[eligibility.profile.fuelGroup].add(vehicle.slug);
  }

  const rankOne: Record<FuelGroup, Map<string, number>> = { EV: new Map(), HEV: new Map(), ICE: new Map() };
  const industryGroups = new Map<string, string>();
  const familyGroups = new Map<string, Map<string, string>>();
  const cargoGroups = new Map<string, Map<string, string>>();
  const chargingGroups = new Map<string, Map<string, string>>();
  const observedCharging = new Set<string>();

  for (const input of inputs) {
    const first = recommendOverlapV2FromSnapshot(input, snapshot).vehicles;
    const second = recommendOverlapV2FromSnapshot(input, snapshot).vehicles;
    if (JSON.stringify(first) !== JSON.stringify(second)) failures.add("nondeterministic_order");
    if (first.length > 3) failures.add("too_many_results");
    const requiredFuel = requiredFuelGroup(input.fuelPreference);
    const top = first[0];
    if (requiredFuel && top) rankOne[requiredFuel].set(top.vehicle.slug, (rankOne[requiredFuel].get(top.vehicle.slug) ?? 0) + 1);

    for (let index = 0; index < first.length; index += 1) {
      const result = first[index];
      const source = vehicleById.get(result.vehicleId);
      const eligibility = source ? assessOperationalEligibility(source, input.annualMileage) : null;
      if (!source || eligibility?.status !== "eligible") failures.add("ineligible_result");
      if (excludedSlugs.has(result.vehicle.slug) || source?.category === "트럭") failures.add("excluded_result");
      if (requiredFuel && eligibility?.status === "eligible" && eligibility.profile.fuelGroup !== requiredFuel) failures.add("fuel_mismatch");
      if (result.documentScore < 0 || result.documentScore > 22.5 || result.chargingAdjustment < -0.04 || result.chargingAdjustment > 0.04 || result.rankScore < -0.04 || result.rankScore > 22.54) failures.add("score_bounds");
      if (Math.abs(result.rankScore - result.documentScore - result.chargingAdjustment) > 1e-9) failures.add("score_arithmetic");
      if (input.fuelPreference === "전기차") {
        const contribution = result.contributions.find((item) => item.axis === "chargingEnvironment");
        if (contribution?.selectedValue !== input.chargingEnvironment) failures.add("charging_contribution");
        else observedCharging.add(input.chargingEnvironment);
      }
      const later = first[index + 1];
      if (later && result.documentScore < later.documentScore && result.documentScore !== later.documentScore) failures.add("charging_reversed_document_score");
    }

    const signature = resultSignature(first);
    const industryKey = comparisonKey(input, "industryDetail");
    const previousIndustry = industryGroups.get(industryKey);
    if (previousIndustry !== undefined && previousIndustry !== signature) failures.add("industry_detail_changed_rank");
    industryGroups.set(industryKey, signature);
    const order = orderSignature(first);
    if (input.situationPreference === "가족") updateVariantGroup(familyGroups, comparisonKey(input, "childDetail"), input.childDetail, order);
    if (input.situationPreference === "화물") updateVariantGroup(cargoGroups, comparisonKey(input, "cargoDetail"), input.cargoDetail, order);
    if (input.fuelPreference === "전기차") updateVariantGroup(chargingGroups, comparisonKey(input, "chargingEnvironment"), input.chargingEnvironment, order);
  }

  const childDetailSensitive = sensitivity(familyGroups, ["영유아", "미취학", "초등", "중학생+"]);
  const cargoDetailSensitive = sensitivity(cargoGroups, ["소형 박스", "대형 화물"]);
  if (Object.values(childDetailSensitive).some((value) => !value)) failures.add("child_detail_insensitive");
  if (Object.values(cargoDetailSensitive).some((value) => !value)) failures.add("cargo_detail_insensitive");
  const externalVsNoChargingSensitive = [...chargingGroups.values()].some((group) => group.has("외부") && group.has("없음") && group.get("외부") !== group.get("없음"));
  if (!externalVsNoChargingSensitive) failures.add("charging_environment_insensitive");
  if (observedCharging.size !== 4) failures.add("charging_environment_unobserved");

  const diversity = {
    EV: diversityResult(eligibleByFuel.EV.size, rankOne.EV),
    HEV: diversityResult(eligibleByFuel.HEV.size, rankOne.HEV),
    ICE: diversityResult(eligibleByFuel.ICE.size, rankOne.ICE),
  };
  if (Object.values(diversity).some((result) => !result.passed)) failures.add("diversity_gate");
  const sortedFailures = [...failures].sort();
  return {
    version: "overlap-v2-audit",
    stateCount: inputs.length,
    catalog: { levels: 45, placements: 150, vehicles: 51, evs: 11, exclusions: 15 },
    configuredProfileCount: configuredProfiles.length,
    activeExcludedConfigCount,
    deterministic: !failures.has("nondeterministic_order"),
    scoreBounds: !failures.has("score_bounds") && !failures.has("score_arithmetic") && !failures.has("charging_reversed_document_score"),
    fuelFidelity: !failures.has("fuel_mismatch"),
    operationalFidelity: !failures.has("ineligible_result") && !failures.has("excluded_result"),
    industryDetailInvariant: !failures.has("industry_detail_changed_rank"),
    childDetailSensitive,
    cargoDetailSensitive,
    chargingEnvironmentsObserved: [...observedCharging].sort(),
    externalVsNoChargingSensitive,
    diversity,
    failures: sortedFailures,
    passed: sortedFailures.length === 0,
  };
}
