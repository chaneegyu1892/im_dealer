import { CARTYPE_TO_CATEGORY } from "../vehicle-import-mappings";
import { invalidVehicleReason } from "./plan";
import type { CrawlVehicleSnapshot, DbVehicleSnapshot, InvalidVehicleCandidate } from "./types";

export type ExistingVehicleApplyPolicyInput = {
  readonly dbVehicles: readonly DbVehicleSnapshot[];
  readonly crawlVehicles: readonly CrawlVehicleSnapshot[];
};

export type VehicleUpdatePolicy = {
  readonly name: string;
  readonly brand: string;
  readonly category: string;
  readonly externalSource: "carpan2";
  readonly basePrice: number;
  readonly thumbnailUrl: string;
  readonly imageUrls: readonly string[];
  readonly description: string | null;
};

export type ExistingVehicleApplyPolicy = {
  readonly vehicleExternalIds: readonly string[];
  readonly skippedNewVehicles: number;
  readonly skippedInvalidVehicles: readonly InvalidVehicleCandidate[];
  readonly vehicleUpdate: VehicleUpdatePolicy | null;
};

export function buildExistingVehicleApplyPolicy(
  input: ExistingVehicleApplyPolicyInput
): ExistingVehicleApplyPolicy {
  const dbVehicleIds = new Set(input.dbVehicles.map((vehicle) => vehicle.externalId));
  const vehicleExternalIds: string[] = [];
  const skippedInvalidVehicles: InvalidVehicleCandidate[] = [];
  let skippedNewVehicles = 0;
  let vehicleUpdate: VehicleUpdatePolicy | null = null;

  for (const vehicle of input.crawlVehicles) {
    const invalidReason = invalidVehicleReason(vehicle);
    if (invalidReason) {
      skippedInvalidVehicles.push({
        vehicleExternalId: vehicle.modelId,
        brand: vehicle.brandName,
        name: vehicle.modelName,
        reason: invalidReason,
      });
      continue;
    }
    if (!dbVehicleIds.has(vehicle.modelId)) {
      skippedNewVehicles++;
      continue;
    }
    vehicleExternalIds.push(vehicle.modelId);
    vehicleUpdate ??= buildVehicleUpdatePolicy(vehicle);
  }

  return { vehicleExternalIds, skippedNewVehicles, skippedInvalidVehicles, vehicleUpdate };
}

export function buildVehicleUpdatePolicy(vehicle: CrawlVehicleSnapshot): VehicleUpdatePolicy {
  return {
    name: vehicle.modelName,
    brand: vehicle.brandName,
    category: CARTYPE_TO_CATEGORY[vehicle.cartypeCode ?? ""] ?? "세단",
    externalSource: "carpan2",
    basePrice: vehicle.priceMin ?? 0,
    thumbnailUrl: vehicle.imageLarge ?? vehicle.cover ?? "",
    imageUrls: uniqueStrings([vehicle.imageLarge, vehicle.cover]),
    description: vehicle.summary,
  };
}

function uniqueStrings(values: readonly (string | null)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
