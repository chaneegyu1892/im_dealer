import type { Prisma } from "@prisma/client";
import { normalizeHex, parseColorTsv } from "../vehicle-import-mappings";
import { toPrismaJson } from "../prisma-json";
import type {
  ExternalModel,
  ExternalModelEntry,
  LegacyImportStats,
} from "./legacy-import-types";

export type LegacyColorImportStore = {
  readonly vehicleColor: {
    readonly upsert: (args: Prisma.VehicleColorUpsertArgs) => Promise<unknown>;
  };
};

type LegacyColorImportRequest = {
  readonly prisma: LegacyColorImportStore;
  readonly vehicleId: string;
  readonly modelEntry: ExternalModelEntry;
  readonly modelDetail: ExternalModel;
  readonly mergeTrimColors: boolean;
  readonly trimColorPriceExt: ReadonlyMap<string, number>;
  readonly trimColorPriceInt: ReadonlyMap<string, number>;
  readonly stats: LegacyImportStats;
};

export async function importLegacyVehicleColors(
  request: LegacyColorImportRequest,
): Promise<number> {
  const exteriorRows = parseColorTsv(request.modelDetail.colorExt);
  const interiorRows = parseColorTsv(request.modelDetail.colorInt);
  let sortOrder = 0;
  for (const row of exteriorRows) {
    const detail = request.modelEntry.detail.colorExt?.[row.id];
    if (!detail) continue;
    const priceDelta = request.mergeTrimColors
      ? Math.max(row.priceDelta, request.trimColorPriceExt.get(row.id) ?? 0)
      : row.priceDelta;
    await request.prisma.vehicleColor.upsert({
      where: {
        vehicleId_kind_externalId: {
          vehicleId: request.vehicleId,
          kind: "EXTERIOR",
          externalId: row.id,
        },
      },
      create: {
        vehicleId: request.vehicleId,
        kind: "EXTERIOR",
        name: detail.name ?? `color-${row.id}`,
        hexCode: normalizeHex(detail.rgb),
        priceDelta,
        sortOrder: sortOrder++,
        externalId: row.id,
        mfgCode: detail.code,
        metadata: toPrismaJson({
          rgb2: detail.rgb2,
          group: detail.group,
          optionJoin: detail.optionJoin,
          optionNot: detail.optionNot,
          intNot: detail.intNot,
        }),
      },
      update: {
        name: detail.name ?? `color-${row.id}`,
        hexCode: normalizeHex(detail.rgb),
        priceDelta,
        mfgCode: detail.code,
      },
    });
    request.stats.colors += 1;
  }

  sortOrder = 0;
  for (const row of interiorRows) {
    const detail = request.modelEntry.detail.colorInt?.[row.id];
    if (!detail) continue;
    const priceDelta = request.mergeTrimColors
      ? Math.max(row.priceDelta, request.trimColorPriceInt.get(row.id) ?? 0)
      : row.priceDelta;
    await request.prisma.vehicleColor.upsert({
      where: {
        vehicleId_kind_externalId: {
          vehicleId: request.vehicleId,
          kind: "INTERIOR",
          externalId: row.id,
        },
      },
      create: {
        vehicleId: request.vehicleId,
        kind: "INTERIOR",
        name: detail.name ?? `color-${row.id}`,
        hexCode: normalizeHex(detail.rgb),
        priceDelta,
        sortOrder: sortOrder++,
        externalId: row.id,
        metadata: toPrismaJson({
          rgb2: detail.rgb2,
          group: detail.group,
          optionJoin: detail.optionJoin,
          optionNot: detail.optionNot,
          extNot: detail.extNot,
        }),
      },
      update: {
        name: detail.name ?? `color-${row.id}`,
        hexCode: normalizeHex(detail.rgb),
        priceDelta,
      },
    });
    request.stats.colors += 1;
  }

  return exteriorRows.length + interiorRows.length;
}
