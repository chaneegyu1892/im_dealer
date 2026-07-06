import { z } from "zod";
import type {
  CrawlColorSnapshot,
  CrawlFileSnapshot,
  CrawlLineupSnapshot,
  CrawlOptionDefinitionSnapshot,
  CrawlTrimSnapshot,
  CrawlTrimOptionSnapshot,
  CrawlVehicleSnapshot,
} from "./types";

const numericLikeSchema = z.union([z.number(), z.string()]).nullable().optional();
const stringLikeSchema = z.string().nullable().optional();

const lineupSchema = z
  .object({
    lineupId: z.string(),
    name: z.string(),
    year: stringLikeSchema,
    state: stringLikeSchema,
  })
  .passthrough();

const fileSchema = z
  .object({
    fileId: z.string(),
    name: stringLikeSchema,
    kind: stringLikeSchema,
    url1: stringLikeSchema,
    url2: stringLikeSchema,
    url3: stringLikeSchema,
    dir: stringLikeSchema,
    count: numericLikeSchema,
  })
  .passthrough();

const optionDefinitionSchema = z
  .object({
    optionId: z.string(),
    name: stringLikeSchema,
    kind: stringLikeSchema,
    apply: stringLikeSchema,
    guide: stringLikeSchema,
    package: stringLikeSchema,
    change: stringLikeSchema,
  })
  .passthrough();

const trimOptionSchema = z
  .object({
    optionId: z.string(),
    name: stringLikeSchema,
    price: numericLikeSchema,
    condition: stringLikeSchema,
    flag: stringLikeSchema,
  })
  .passthrough();

const colorSchema = z
  .object({
    colorId: z.string(),
    name: stringLikeSchema,
    code: stringLikeSchema,
    price: numericLikeSchema,
    rgb: stringLikeSchema,
    rgb2: stringLikeSchema,
    flag: stringLikeSchema,
  })
  .passthrough();

const trimSchema = z
  .object({
    trimId: z.string(),
    lineupId: stringLikeSchema,
    name: stringLikeSchema,
    price: numericLikeSchema,
    state: stringLikeSchema,
    engineCode: stringLikeSchema,
    displace: stringLikeSchema,
    person: stringLikeSchema,
    carry: stringLikeSchema,
    options: z.array(trimOptionSchema).optional().default([]),
  })
  .passthrough();

const vehicleSchema = z
  .object({
    modelId: z.string(),
    brandName: z.string(),
    modelName: z.string(),
    cartypeCode: stringLikeSchema,
    engineCode: stringLikeSchema,
    state: stringLikeSchema,
    summary: stringLikeSchema,
    price: z
      .object({
        min: numericLikeSchema,
      })
      .passthrough()
      .nullable()
      .optional(),
    imageLarge: stringLikeSchema,
    cover: stringLikeSchema,
    catalogFiles: z.array(fileSchema).optional().default([]),
    priceFiles: z.array(fileSchema).optional().default([]),
    options: z.array(optionDefinitionSchema).optional().default([]),
    exteriorColors: z.array(colorSchema).optional().default([]),
    interiorColors: z.array(colorSchema).optional().default([]),
    lineups: z.array(lineupSchema).optional().default([]),
    trims: z.array(trimSchema).optional().default([]),
  })
  .passthrough();

const carpan2FileSchema = z
  .object({
    vehicles: z.array(vehicleSchema),
  })
  .passthrough();

type NumericLike = z.infer<typeof numericLikeSchema>;
type RawLineup = z.infer<typeof lineupSchema>;
type RawFile = z.infer<typeof fileSchema>;
type RawOptionDefinition = z.infer<typeof optionDefinitionSchema>;
type RawTrimOption = z.infer<typeof trimOptionSchema>;
type RawColor = z.infer<typeof colorSchema>;
type RawTrim = z.infer<typeof trimSchema>;
type RawVehicle = z.infer<typeof vehicleSchema>;

export function parseCarpan2Vehicles(input: unknown): readonly CrawlVehicleSnapshot[] {
  const parsed = carpan2FileSchema.parse(input);
  return parsed.vehicles.map(toVehicleSnapshot);
}

function toVehicleSnapshot(vehicle: RawVehicle): CrawlVehicleSnapshot {
  return {
    modelId: vehicle.modelId,
    brandName: vehicle.brandName,
    modelName: vehicle.modelName,
    cartypeCode: toNullableString(vehicle.cartypeCode),
    engineCode: toNullableString(vehicle.engineCode),
    state: toNullableString(vehicle.state),
    summary: toNullableString(vehicle.summary),
    priceMin: toNumber(vehicle.price?.min),
    imageLarge: toNullableString(vehicle.imageLarge),
    cover: toNullableString(vehicle.cover),
    catalogFileCount: vehicle.catalogFiles.length,
    priceFileCount: vehicle.priceFiles.length,
    catalogFiles: vehicle.catalogFiles.map(toFileSnapshot),
    priceFiles: vehicle.priceFiles.map(toFileSnapshot),
    options: vehicle.options.map(toOptionDefinitionSnapshot),
    exteriorColors: vehicle.exteriorColors.map(toColorSnapshot),
    interiorColors: vehicle.interiorColors.map(toColorSnapshot),
    lineups: vehicle.lineups.map(toLineupSnapshot),
    trims: vehicle.trims.map(toTrimSnapshot),
  };
}

function toLineupSnapshot(lineup: RawLineup): CrawlLineupSnapshot {
  return {
    lineupId: lineup.lineupId,
    name: lineup.name,
    year: toNullableString(lineup.year),
    state: toNullableString(lineup.state),
  };
}

function toTrimSnapshot(trim: RawTrim): CrawlTrimSnapshot {
  return {
    trimId: trim.trimId,
    lineupId: toNullableString(trim.lineupId),
    name: toNullableString(trim.name),
    price: toNumber(trim.price),
    state: toNullableString(trim.state),
    engineCode: toNullableString(trim.engineCode),
    displace: toNullableString(trim.displace),
    person: toNullableString(trim.person),
    carry: toNullableString(trim.carry),
    options: trim.options.map(toTrimOptionSnapshot),
  };
}

function toFileSnapshot(file: RawFile): CrawlFileSnapshot {
  return {
    fileId: file.fileId,
    name: toNullableString(file.name),
    kind: toNullableString(file.kind),
    url1: toNullableString(file.url1),
    url2: toNullableString(file.url2),
    url3: toNullableString(file.url3),
    dir: toNullableString(file.dir),
    count: toNumber(file.count),
  };
}

function toOptionDefinitionSnapshot(option: RawOptionDefinition): CrawlOptionDefinitionSnapshot {
  return {
    optionId: option.optionId,
    name: toNullableString(option.name),
    kind: toNullableString(option.kind),
    apply: toNullableString(option.apply),
    guide: toNullableString(option.guide),
    package: toNullableString(option.package),
    change: toNullableString(option.change),
  };
}

function toTrimOptionSnapshot(option: RawTrimOption): CrawlTrimOptionSnapshot {
  return {
    optionId: option.optionId,
    name: toNullableString(option.name),
    price: toNumber(option.price) ?? 0,
    condition: toNullableString(option.condition),
    flag: toNullableString(option.flag),
  };
}

function toColorSnapshot(color: RawColor): CrawlColorSnapshot {
  return {
    colorId: color.colorId,
    name: toNullableString(color.name),
    code: toNullableString(color.code),
    price: toNumber(color.price) ?? 0,
    rgb: toNullableString(color.rgb),
    rgb2: toNullableString(color.rgb2),
    flag: toNullableString(color.flag),
  };
}

function toNumber(value: NumericLike): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNullableString(value: string | null | undefined): string | null {
  return value ?? null;
}
