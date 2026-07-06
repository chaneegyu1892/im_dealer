import { z } from "zod";
import type {
  Carpan2CatalogFile,
  Carpan2ImageColor,
  Carpan2ImageVehicle,
  Carpan2ModelItem,
} from "./types";

const stringLikeSchema = z.union([z.string(), z.number()]).nullable().optional();
const numericLikeSchema = z.union([z.string(), z.number()]).nullable().optional();

const colorSchema = z
  .object({
    colorId: z.string(),
    name: stringLikeSchema,
  })
  .passthrough();

const catalogFileSchema = z
  .object({
    fileId: z.string(),
    name: stringLikeSchema,
    dir: stringLikeSchema,
    count: numericLikeSchema,
  })
  .passthrough();

const modelItemFeatureSchema = z
  .object({
    name: stringLikeSchema,
    photo: stringLikeSchema,
  })
  .passthrough();

const modelItemFileSchema = z
  .object({
    image: stringLikeSchema,
    title: stringLikeSchema,
    linkItem: stringLikeSchema,
  })
  .passthrough();

const modelItemOptionSchema = z
  .object({
    photo: stringLikeSchema,
  })
  .passthrough();

const colorExtImageSchema = z
  .object({
    url: stringLikeSchema,
  })
  .passthrough();

const colorIntImageSchema = z
  .object({
    url: stringLikeSchema,
    subject: stringLikeSchema,
  })
  .passthrough();

const modelItemSchema = z
  .object({
    item: z.record(modelItemFeatureSchema).optional().default({}),
    model: z.record(z.record(z.string())).optional().default({}),
    kind: z.record(z.unknown()).optional().default({}),
    files: z.record(modelItemFileSchema).optional().default({}),
    option: z.record(z.unknown()).optional().default({}),
    colorExt: z.record(z.record(colorExtImageSchema)).optional().default({}),
    colorInt: z.record(z.array(colorIntImageSchema)).optional().default({}),
  })
  .passthrough();

const vehicleSchema = z
  .object({
    modelId: z.string(),
    brandName: z.string(),
    modelName: z.string(),
    image: stringLikeSchema,
    imageLarge: stringLikeSchema,
    cover: stringLikeSchema,
    catalogFiles: z.array(catalogFileSchema).optional().default([]),
    exteriorColors: z.array(colorSchema).optional().default([]),
    interiorColors: z.array(colorSchema).optional().default([]),
    raw: z
      .object({
        modelItem: modelItemSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const carpan2ImageFileSchema = z
  .object({
    vehicles: z.array(vehicleSchema),
  })
  .passthrough();

type RawVehicle = z.infer<typeof vehicleSchema>;
type RawColor = z.infer<typeof colorSchema>;
type RawCatalogFile = z.infer<typeof catalogFileSchema>;
type RawModelItem = z.infer<typeof modelItemSchema>;
type NumericLike = z.infer<typeof numericLikeSchema>;

export function parseCarpan2ImageVehicles(input: unknown): readonly Carpan2ImageVehicle[] {
  const parsed = carpan2ImageFileSchema.parse(input);
  return parsed.vehicles.map(toVehicle);
}

function toVehicle(vehicle: RawVehicle): Carpan2ImageVehicle {
  return {
    modelId: vehicle.modelId,
    brandName: vehicle.brandName,
    modelName: vehicle.modelName,
    image: toNullableString(vehicle.image),
    imageLarge: toNullableString(vehicle.imageLarge),
    cover: toNullableString(vehicle.cover),
    catalogFiles: vehicle.catalogFiles.map(toCatalogFile),
    exteriorColors: vehicle.exteriorColors.map(toColor),
    interiorColors: vehicle.interiorColors.map(toColor),
    modelItem: vehicle.raw?.modelItem ? toModelItem(vehicle.raw.modelItem) : null,
  };
}

function toColor(color: RawColor): Carpan2ImageColor {
  return {
    colorId: color.colorId,
    name: toNullableString(color.name),
  };
}

function toCatalogFile(file: RawCatalogFile): Carpan2CatalogFile {
  return {
    fileId: file.fileId,
    name: toNullableString(file.name),
    dir: toNullableString(file.dir),
    count: toNumber(file.count),
  };
}

function toModelItem(item: RawModelItem): Carpan2ModelItem {
  return {
    item: Object.fromEntries(
      Object.entries(item.item).map(([id, feature]) => [
        id,
        {
          name: toNullableString(feature.name),
          photo: toNullableString(feature.photo),
        },
      ]),
    ),
    model: item.model,
    kind: item.kind,
    files: Object.fromEntries(
      Object.entries(item.files).map(([id, file]) => [
        id,
        {
          image: toNullableString(file.image),
          title: toNullableString(file.title),
          linkItem: toNullableString(file.linkItem),
        },
      ]),
    ),
    option: toModelItemOptions(item.option),
    colorExt: Object.fromEntries(
      Object.entries(item.colorExt).map(([bodyId, colors]) => [
        bodyId,
        Object.fromEntries(
          Object.entries(colors).map(([colorId, color]) => [
            colorId,
            { url: toNullableString(color.url) },
          ]),
        ),
      ]),
    ),
    colorInt: Object.fromEntries(
      Object.entries(item.colorInt).map(([colorId, images]) => [
        colorId,
        images.map((image) => ({
          url: toNullableString(image.url),
          subject: toNullableString(image.subject),
        })),
      ]),
    ),
  };
}

function toModelItemOptions(
  options: Readonly<Record<string, unknown>>,
): Readonly<Record<string, { readonly photo: string | null }>> {
  const parsedOptions: Record<string, { readonly photo: string | null }> = {};
  for (const [id, option] of Object.entries(options)) {
    const parsed = modelItemOptionSchema.safeParse(option);
    if (!parsed.success) continue;
    parsedOptions[id] = { photo: toNullableString(parsed.data.photo) };
  }
  return parsedOptions;
}

function toNullableString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNumber(value: NumericLike): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
