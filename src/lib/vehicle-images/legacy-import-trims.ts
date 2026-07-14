import type { Prisma } from "@prisma/client";
import {
  isCurrentlySold,
  mapOptionKind,
  parseColorTsv,
  parseOptionTsv,
  pickPrimaryEngine,
  pickRepresentativeEfficiency,
} from "../vehicle-import-mappings";
import { toPrismaJson } from "../prisma-json";
import type {
  ExternalModel,
  ExternalModelEntry,
  LegacyImportStats,
} from "./legacy-import-types";
import { parseLegacyInteger, splitLegacyCsv } from "./legacy-import-values";

export type LegacyTrimImportStore = {
  readonly vehicleLineup: {
    readonly upsert: (
      args: Prisma.VehicleLineupUpsertArgs,
    ) => Promise<{ readonly id: string }>;
  };
  readonly trim: {
    readonly upsert: (
      args: Prisma.TrimUpsertArgs,
    ) => Promise<{ readonly id: string }>;
  };
  readonly trimOption: {
    readonly upsert: (args: Prisma.TrimOptionUpsertArgs) => Promise<unknown>;
  };
};

type LegacyTrimImportRequest = {
  readonly prisma: LegacyTrimImportStore;
  readonly vehicleId: string;
  readonly modelEntry: ExternalModelEntry;
  readonly modelDetail: ExternalModel;
  readonly stats: LegacyImportStats;
};

export type LegacyTrimImportResult = {
  readonly trimColorPriceExt: ReadonlyMap<string, number>;
  readonly trimColorPriceInt: ReadonlyMap<string, number>;
};

export async function importLegacyLineupsAndTrims(
  request: LegacyTrimImportRequest,
): Promise<LegacyTrimImportResult> {
  const lineups = request.modelEntry.detail.lineup ?? {};
  const lineupIdMap = new Map<string, string>();
  for (const [externalId, lineup] of Object.entries(lineups)) {
    const created = await request.prisma.vehicleLineup.upsert({
      where: { externalId },
      create: {
        vehicleId: request.vehicleId,
        name: lineup.name ?? `lineup-${externalId}`,
        externalId,
        isVisible: false,
        metadata: toPrismaJson(lineup),
      },
      update: {
        name: lineup.name ?? `lineup-${externalId}`,
        metadata: toPrismaJson(lineup),
      },
    });
    lineupIdMap.set(externalId, created.id);
    request.stats.lineups += 1;
  }

  const trimColorPriceExt = new Map<string, number>();
  const trimColorPriceInt = new Map<string, number>();
  const trims = request.modelEntry.detail.trim ?? {};
  for (const [externalId, trim] of Object.entries(trims)) {
    const lineupId = trim.lineup ? lineupIdMap.get(trim.lineup) : undefined;
    const trimColorExt = parseColorTsv(trim.colorExt);
    const trimColorInt = parseColorTsv(trim.colorInt);
    mergePositivePrices(trimColorPriceExt, trimColorExt);
    mergePositivePrices(trimColorPriceInt, trimColorInt);

    const documentIds = [trim.items, ...splitLegacyCsv(trim.itemsLink)]
      .flatMap((id) => id ? [id] : []);
    const documents = documentIds
      .map((id) => request.modelEntry.detail.document?.[id])
      .filter(Boolean);
    const detailedSpecs = {
      externalRaw: {
        ...trim,
        documents,
        colorPriceMap: { ext: trimColorExt, int: trimColorInt },
      },
    };
    const created = await request.prisma.trim.upsert({
      where: { externalId },
      create: {
        vehicleId: request.vehicleId,
        lineupId,
        name: trim.name ?? `trim-${externalId}`,
        price: parseLegacyInteger(trim.price) || 0,
        engineType: pickPrimaryEngine(trim.engine ?? request.modelDetail.engine ?? "G"),
        fuelEfficiency: pickRepresentativeEfficiency(request.modelDetail.efficiency),
        externalId,
        isVisible: isCurrentlySold(trim.state),
        specs: toPrismaJson({ lineup: trim.lineup, displace: trim.displace }),
        detailedSpecs: toPrismaJson(detailedSpecs),
      },
      update: {
        vehicleId: request.vehicleId,
        lineupId,
        name: trim.name ?? `trim-${externalId}`,
        price: parseLegacyInteger(trim.price) || 0,
        engineType: pickPrimaryEngine(trim.engine ?? request.modelDetail.engine ?? "G"),
        isVisible: isCurrentlySold(trim.state),
        specs: toPrismaJson({ lineup: trim.lineup, displace: trim.displace }),
        detailedSpecs: toPrismaJson(detailedSpecs),
      },
    });
    request.stats.trims += 1;
    await importLegacyOptions(request, created.id, trim.option);
  }

  return { trimColorPriceExt, trimColorPriceInt };
}

type PriceRow = {
  readonly id: string;
  readonly priceDelta: number;
};

function mergePositivePrices(
  target: Map<string, number>,
  rows: readonly PriceRow[],
): void {
  for (const row of rows) {
    if (row.priceDelta > 0) {
      target.set(row.id, Math.max(target.get(row.id) ?? 0, row.priceDelta));
    }
  }
}

async function importLegacyOptions(
  request: LegacyTrimImportRequest,
  trimId: string,
  rawOptions: string | undefined,
): Promise<void> {
  for (const option of parseOptionTsv(rawOptions)) {
    const detail = request.modelEntry.detail.option?.[option.id];
    const kind = mapOptionKind(detail?.kind);
    const description = [detail?.apply, detail?.guide, detail?.package]
      .filter(Boolean)
      .join("\n\n");
    await request.prisma.trimOption.upsert({
      where: { trimId_externalId: { trimId, externalId: option.id } },
      create: {
        trimId,
        name: detail?.name ?? `option-${option.id}`,
        price: option.price,
        category: kind.category,
        isAccessory: kind.isAccessory,
        description: description || null,
        externalId: option.id,
        metadata: toPrismaJson({
          kind: detail?.kind,
          condition: option.condition,
          flag: option.flag,
          extNot: detail?.extNot,
          intNot: detail?.intNot,
          extJoin: detail?.extJoin,
          intJoin: detail?.intJoin,
          packageRemark: detail?.packageRemark,
        }),
      },
      update: {
        name: detail?.name ?? `option-${option.id}`,
        price: option.price,
        category: kind.category,
        isAccessory: kind.isAccessory,
        description: description || null,
        metadata: toPrismaJson({
          kind: detail?.kind,
          condition: option.condition,
          flag: option.flag,
        }),
      },
    });
    request.stats.options += 1;
  }
}
