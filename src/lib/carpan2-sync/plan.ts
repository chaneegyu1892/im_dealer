import type {
  BuildCarpan2SyncPlanInput,
  Carpan2SyncPlan,
  CrawlTrimSnapshot,
  CrawlVehicleSnapshot,
  DbTrimSnapshot,
  DbVehicleSnapshot,
  InvalidTrimCandidate,
  InvalidVehicleCandidate,
  RatedTrimRisk,
} from "./types";

export type {
  BuildCarpan2SyncPlanInput,
  Carpan2SyncPlan,
  CrawlLineupSnapshot,
  CrawlTrimSnapshot,
  CrawlVehicleSnapshot,
  DbTrimSnapshot,
  DbVehicleSnapshot,
  InvalidTrimCandidate,
  InvalidVehicleCandidate,
  RatedTrimRisk,
} from "./types";

export const DATABASE_INT_MAX = 2_147_483_647;

export function buildCarpan2SyncPlan(input: BuildCarpan2SyncPlanInput): Carpan2SyncPlan {
  const dbVehicleById = new Map(input.dbVehicles.map((vehicle) => [vehicle.externalId, vehicle]));
  const crawlVehicleById = new Map(input.crawlVehicles.map((vehicle) => [vehicle.modelId, vehicle]));
  const dbTrimById = new Map<string, { readonly vehicle: DbVehicleSnapshot; readonly trim: DbTrimSnapshot }>();
  const crawlTrimById = new Map<
    string,
    { readonly vehicle: CrawlVehicleSnapshot; readonly trim: CrawlTrimSnapshot }
  >();

  for (const vehicle of input.dbVehicles) {
    for (const trim of vehicle.trims) {
      dbTrimById.set(trim.externalId, { vehicle, trim });
    }
  }
  for (const vehicle of input.crawlVehicles) {
    for (const trim of vehicle.trims) {
      crawlTrimById.set(trim.trimId, { vehicle, trim });
    }
  }

  const invalidVehicleIds = new Set<string>();
  const invalidVehicles: InvalidVehicleCandidate[] = [];
  let insertVehicles = 0;
  let updateVehicles = 0;

  for (const vehicle of input.crawlVehicles) {
    const reason = invalidVehicleReason(vehicle);
    if (reason) {
      invalidVehicleIds.add(vehicle.modelId);
      invalidVehicles.push({
        vehicleExternalId: vehicle.modelId,
        brand: vehicle.brandName,
        name: vehicle.modelName,
        reason,
      });
    } else if (dbVehicleById.has(vehicle.modelId)) {
      updateVehicles++;
    } else {
      insertVehicles++;
    }
  }

  const invalidTrims: InvalidTrimCandidate[] = [];
  let insertTrims = 0;
  let updateTrims = 0;
  let rewriteVisibilityCandidates = 0;

  for (const vehicle of input.crawlVehicles) {
    for (const trim of vehicle.trims) {
      const reason = invalidTrimReason(vehicle, trim, invalidVehicleIds.has(vehicle.modelId));
      if (reason) {
        invalidTrims.push({
          vehicleExternalId: vehicle.modelId,
          trimExternalId: trim.trimId,
          name: trim.name ?? `trim-${trim.trimId}`,
          reason,
        });
        continue;
      }

      const existing = dbTrimById.get(trim.trimId);
      if (existing) {
        updateTrims++;
        if (existing.trim.isVisible !== isCurrentlySold(trim.state)) {
          rewriteVisibilityCandidates++;
        }
      } else {
        insertTrims++;
      }
    }
  }

  const missingRatedVehicles: string[] = [];
  const missingRatedTrims: RatedTrimRisk[] = [];
  const stateChangedRatedTrims: RatedTrimRisk[] = [];
  const valueChangedRatedTrims: RatedTrimRisk[] = [];
  let ratedVehicles = 0;
  let ratedTrims = 0;
  let preserveDbOnlyTrims = 0;

  for (const vehicle of input.dbVehicles) {
    const vehicleRateCount = vehicle.trims.reduce((sum, trim) => sum + trim.activeRateSheetCount, 0);
    if (vehicleRateCount > 0) {
      ratedVehicles++;
      if (!crawlVehicleById.has(vehicle.externalId)) {
        missingRatedVehicles.push(vehicle.externalId);
      }
    }

    for (const trim of vehicle.trims) {
      if (!crawlTrimById.has(trim.externalId)) {
        preserveDbOnlyTrims++;
        if (trim.activeRateSheetCount > 0) {
          ratedTrims++;
          missingRatedTrims.push(toRatedTrimRisk(vehicle, trim, null));
        }
        continue;
      }

      const crawl = crawlTrimById.get(trim.externalId);
      if (!crawl || trim.activeRateSheetCount === 0) {
        continue;
      }

      ratedTrims++;
      if (crawl.trim.state !== "2") {
        stateChangedRatedTrims.push(toRatedTrimRisk(vehicle, trim, crawl.trim));
      }
      if (trim.name !== crawl.trim.name || trim.price !== crawl.trim.price) {
        valueChangedRatedTrims.push(toRatedTrimRisk(vehicle, trim, crawl.trim));
      }
    }
  }

  const crawlTrims = input.crawlVehicles.reduce((sum, vehicle) => sum + vehicle.trims.length, 0);
  const crawlLineups = input.crawlVehicles.reduce((sum, vehicle) => sum + vehicle.lineups.length, 0);
  const dbTrims = input.dbVehicles.reduce((sum, vehicle) => sum + vehicle.trims.length, 0);

  return {
    totals: {
      dbVehicles: input.dbVehicles.length,
      crawlVehicles: input.crawlVehicles.length,
      dbTrims,
      crawlTrims,
      crawlLineups,
      catalogFiles: input.crawlVehicles.reduce((sum, vehicle) => sum + vehicle.catalogFileCount, 0),
      priceFiles: input.crawlVehicles.reduce((sum, vehicle) => sum + vehicle.priceFileCount, 0),
      vehiclesWithImageLarge: input.crawlVehicles.filter((vehicle) => Boolean(vehicle.imageLarge)).length,
      vehiclesWithCover: input.crawlVehicles.filter((vehicle) => Boolean(vehicle.cover)).length,
    },
    vehicleActions: {
      insertNew: insertVehicles,
      updateExisting: updateVehicles,
      preserveDbOnly: input.dbVehicles.filter((vehicle) => !crawlVehicleById.has(vehicle.externalId)).length,
      skipInvalid: invalidVehicles,
    },
    trimActions: {
      insertNew: insertTrims,
      updateExisting: updateTrims,
      preserveDbOnly: preserveDbOnlyTrims,
      rewriteVisibilityCandidates,
      skipInvalid: invalidTrims,
    },
    ratedSafety: {
      ratedVehicles,
      ratedTrims,
      missingRatedVehicles,
      missingRatedTrims,
      stateChangedRatedTrims,
      valueChangedRatedTrims,
    },
  };
}

export function invalidVehicleReason(vehicle: CrawlVehicleSnapshot): string | null {
  if (!vehicle.modelId.trim()) return "vehicle externalId is missing";
  if (!vehicle.brandName.trim()) return "brand name is missing";
  if (!vehicle.modelName.trim()) return "vehicle name is missing";
  if (vehicle.priceMin === null) return "base price is missing";
  if (!Number.isFinite(vehicle.priceMin) || vehicle.priceMin < 0) return "base price is invalid";
  if (vehicle.priceMin > DATABASE_INT_MAX) return "base price exceeds database Int range";
  return null;
}

export function invalidTrimReason(
  vehicle: CrawlVehicleSnapshot,
  trim: CrawlTrimSnapshot,
  parentVehicleInvalid: boolean
): string | null {
  if (!trim.trimId.trim()) return "trim externalId is missing";
  if (!trim.name?.trim()) return "trim name is missing";
  if (trim.price === null) return "trim price is missing";
  if (!Number.isFinite(trim.price) || trim.price < 0) return "trim price is invalid";
  if (trim.price > DATABASE_INT_MAX) return "trim price exceeds database Int range";
  if (parentVehicleInvalid) return `parent vehicle ${vehicle.modelId} is invalid`;
  return null;
}

function isCurrentlySold(state: string | null): boolean {
  return state === "2";
}

function toRatedTrimRisk(
  vehicle: DbVehicleSnapshot,
  trim: DbTrimSnapshot,
  crawlTrim: CrawlTrimSnapshot | null
): RatedTrimRisk {
  return {
    vehicleExternalId: vehicle.externalId,
    trimExternalId: trim.externalId,
    dbName: trim.name,
    crawlName: crawlTrim?.name ?? null,
    crawlState: crawlTrim?.state ?? null,
    activeRateSheetCount: trim.activeRateSheetCount,
  };
}
