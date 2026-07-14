import { Prisma, type PrismaClient } from "@prisma/client";
import {
  isCurrentlySold,
  mapOptionKind,
  pickPrimaryEngine,
} from "../vehicle-import-mappings";
import { buildVehicleUpdatePolicy } from "./apply-policy";
import { invalidTrimReason, invalidVehicleReason } from "./plan";
import { upsertColors } from "./prisma-apply-colors";
import {
  addStats,
  buildLineupMetadata,
  buildOptionMetadata,
  buildTrimDetailedSpecs,
  buildTrimSpecs,
  createStats,
  optionDescription,
  type MutableApplyStats,
} from "./prisma-apply-helpers";
import type {
  CrawlLineupSnapshot,
  CrawlOptionDefinitionSnapshot,
  CrawlTrimOptionSnapshot,
  CrawlTrimSnapshot,
  CrawlVehicleSnapshot,
} from "./types";

export type ApplyExistingVehiclesStats = {
  readonly vehiclesUpdated: number;
  readonly newVehiclesSkipped: number;
  readonly invalidVehiclesSkipped: number;
  readonly lineupsUpserted: number;
  readonly trimsUpserted: number;
  readonly invalidTrimsSkipped: number;
  readonly optionsUpserted: number;
  readonly colorsUpserted: number;
};

type ExistingVehicleRow = {
  readonly id: string; readonly externalId: string;
};

const VEHICLE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 300_000 } as const;

export async function applyExistingVehiclesToPrisma(input: {
  readonly prisma: PrismaClient;
  readonly crawlVehicles: readonly CrawlVehicleSnapshot[];
  readonly includeOptionsAndColors?: boolean;
  readonly transactionRunner?: <TResult>(
    mutation: (tx: Prisma.TransactionClient) => Promise<TResult>,
  ) => Promise<TResult>;
  readonly onVehicleApplied?: (progress: {
    readonly processedVehicles: number;
    readonly totalVehicles: number;
    readonly vehicleName: string;
    readonly stats: ApplyExistingVehiclesStats;
  }) => void;
}): Promise<ApplyExistingVehiclesStats> {
  const existingVehicles = await loadExistingVehicleRows(input.prisma, input.crawlVehicles);
  const stats = createStats();
  let processedVehicles = 0;

  for (const vehicle of input.crawlVehicles) {
    const invalidReason = invalidVehicleReason(vehicle);
    if (invalidReason) {
      stats.invalidVehiclesSkipped++;
      continue;
    }

    const existingVehicle = existingVehicles.get(vehicle.modelId);
    if (!existingVehicle) {
      stats.newVehiclesSkipped++;
      continue;
    }

    const mutation = async (tx: Prisma.TransactionClient): Promise<MutableApplyStats> =>
      applyOneExistingVehicle(tx, {
        existingVehicle,
        includeOptionsAndColors: input.includeOptionsAndColors ?? false,
        vehicle,
      });
    const result = input.transactionRunner
      ? await input.transactionRunner(mutation)
      : await input.prisma.$transaction(mutation, VEHICLE_TRANSACTION_OPTIONS);
    addStats(stats, result);
    processedVehicles++;
    input.onVehicleApplied?.({
      processedVehicles,
      totalVehicles: existingVehicles.size,
      vehicleName: `${vehicle.brandName} ${vehicle.modelName}`,
      stats: { ...stats },
    });
  }

  return stats;
}

async function loadExistingVehicleRows(
  prisma: PrismaClient,
  crawlVehicles: readonly CrawlVehicleSnapshot[]
): Promise<ReadonlyMap<string, ExistingVehicleRow>> {
  const rows = await prisma.vehicle.findMany({
    where: { externalId: { in: crawlVehicles.map((vehicle) => vehicle.modelId) } },
    select: { id: true, externalId: true },
  });
  const byExternalId = new Map<string, ExistingVehicleRow>();
  for (const row of rows) {
    if (row.externalId) byExternalId.set(row.externalId, { id: row.id, externalId: row.externalId });
  }
  return byExternalId;
}

async function applyOneExistingVehicle(
  tx: Prisma.TransactionClient,
  input: {
    readonly existingVehicle: ExistingVehicleRow;
    readonly includeOptionsAndColors: boolean;
    readonly vehicle: CrawlVehicleSnapshot;
  }
): Promise<MutableApplyStats> {
  const stats = createStats();
  const vehicleUpdate = buildVehicleUpdatePolicy(input.vehicle);

  await tx.brand.upsert({
    where: { name: input.vehicle.brandName },
    create: { name: input.vehicle.brandName, displayOrder: 1000 },
    update: {},
  });

  await tx.vehicle.update({
    where: { id: input.existingVehicle.id },
    data: vehicleUpdate,
  });
  stats.vehiclesUpdated++;

  const lineupIds = await upsertLineups(tx, input.existingVehicle.id, input.vehicle.lineups);
  stats.lineupsUpserted += lineupIds.size;
  const optionDefinitions = new Map(input.vehicle.options.map((option) => [option.optionId, option]));

  for (const trim of input.vehicle.trims) {
    const invalidTrim = invalidTrimReason(input.vehicle, trim, false);
    if (invalidTrim) {
      stats.invalidTrimsSkipped++;
      continue;
    }
    const dbTrim = await upsertTrim(tx, {
      vehicleId: input.existingVehicle.id,
      vehicle: input.vehicle,
      trim,
      lineupId: trim.lineupId ? lineupIds.get(trim.lineupId) ?? null : null,
    });
    stats.trimsUpserted++;
    if (input.includeOptionsAndColors) {
      stats.optionsUpserted += await upsertTrimOptions(tx, {
        trimId: dbTrim.id,
        options: trim.options,
        optionDefinitions,
      });
    }
  }

  if (input.includeOptionsAndColors) {
    stats.colorsUpserted += await upsertColors(tx, {
      vehicleId: input.existingVehicle.id,
      colors: input.vehicle.exteriorColors,
      kind: "EXTERIOR",
    });
    stats.colorsUpserted += await upsertColors(tx, {
      vehicleId: input.existingVehicle.id,
      colors: input.vehicle.interiorColors,
      kind: "INTERIOR",
    });
  }

  return stats;
}

async function upsertLineups(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  lineups: readonly CrawlLineupSnapshot[]
): Promise<ReadonlyMap<string, string>> {
  const lineupIds = new Map<string, string>();
  for (const lineup of lineups) {
    const dbLineup = await tx.vehicleLineup.upsert({
      where: { externalId: lineup.lineupId },
      create: {
        vehicleId,
        externalId: lineup.lineupId,
        name: lineup.name,
        isVisible: false,
        metadata: buildLineupMetadata(lineup),
      },
      update: { vehicleId, name: lineup.name, metadata: buildLineupMetadata(lineup) },
    });
    lineupIds.set(lineup.lineupId, dbLineup.id);
  }
  return lineupIds;
}

async function upsertTrim(
  tx: Prisma.TransactionClient,
  input: {
    readonly vehicleId: string;
    readonly vehicle: CrawlVehicleSnapshot;
    readonly trim: CrawlTrimSnapshot;
    readonly lineupId: string | null;
  }
): Promise<{ readonly id: string }> {
  const engineCode = input.trim.engineCode ?? input.vehicle.engineCode ?? "G";
  const specs = buildTrimSpecs(input.trim);
  const detailedSpecs = buildTrimDetailedSpecs(input.trim);
  const isVisible = isCurrentlySold(input.trim.state);
  return tx.trim.upsert({
    where: { externalId: input.trim.trimId },
    create: {
      vehicleId: input.vehicleId,
      lineupId: input.lineupId,
      externalId: input.trim.trimId,
      name: input.trim.name ?? `trim-${input.trim.trimId}`,
      price: input.trim.price ?? 0,
      engineType: pickPrimaryEngine(engineCode),
      isVisible,
      specs,
      detailedSpecs,
    },
    update: {
      vehicleId: input.vehicleId,
      lineupId: input.lineupId,
      name: input.trim.name ?? `trim-${input.trim.trimId}`,
      price: input.trim.price ?? 0,
      engineType: pickPrimaryEngine(engineCode),
      isVisible,
      specs,
      detailedSpecs,
    },
    select: { id: true },
  });
}

async function upsertTrimOptions(
  tx: Prisma.TransactionClient,
  input: {
    readonly trimId: string;
    readonly options: readonly CrawlTrimOptionSnapshot[];
    readonly optionDefinitions: ReadonlyMap<string, CrawlOptionDefinitionSnapshot>;
  }
): Promise<number> {
  let count = 0;
  for (const option of input.options) {
    const definition = input.optionDefinitions.get(option.optionId);
    const optionKind = mapOptionKind(definition?.kind);
    await tx.trimOption.upsert({
      where: { trimId_externalId: { trimId: input.trimId, externalId: option.optionId } },
      create: {
        trimId: input.trimId,
        externalId: option.optionId,
        name: option.name ?? definition?.name ?? `option-${option.optionId}`,
        price: option.price,
        category: optionKind.category,
        isAccessory: optionKind.isAccessory,
        description: optionDescription(definition),
        metadata: buildOptionMetadata(option, definition),
      },
      update: {
        name: option.name ?? definition?.name ?? `option-${option.optionId}`,
        price: option.price,
        category: optionKind.category,
        isAccessory: optionKind.isAccessory,
        description: optionDescription(definition),
        metadata: buildOptionMetadata(option, definition),
      },
    });
    count++;
  }
  return count;
}
