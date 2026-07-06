import {
  CARPAN2_IMAGE_TYPES,
  type Carpan2ImageCandidate,
  type Carpan2ImageType,
  type Carpan2ImageVehicle,
  type Carpan2ModelItem,
  type ImageExtractionOptions,
  type ImageMetadata,
} from "./types";

const CARPAN_IMAGE_BASE_URL = "https://www.carpan.co.kr/img/";

const SPEC_KIND_ORDER = [
  CARPAN2_IMAGE_TYPES.SPEC_EXTERIOR,
  CARPAN2_IMAGE_TYPES.SPEC_INTERIOR,
  CARPAN2_IMAGE_TYPES.SPEC_SEAT,
] as const;

export function extractCarpan2ImageCandidates(
  vehicle: Carpan2ImageVehicle,
  options: ImageExtractionOptions,
): readonly Carpan2ImageCandidate[] {
  const candidates: Carpan2ImageCandidate[] = [];
  const seenSourceUrls = new Set<string>();
  let displayOrder = 0;

  const addCandidate = (input: CandidateInput): void => {
    const sourceUrl = normalizeCarpan2ImageUrl(input.sourcePath);
    if (!sourceUrl || seenSourceUrls.has(sourceUrl)) return;
    seenSourceUrls.add(sourceUrl);
    candidates.push({
      vehicleExternalId: vehicle.modelId,
      type: input.type,
      title: input.title,
      sourceUrl,
      sourceKey: `${input.type}:${input.key}`,
      displayOrder,
      metadata: input.metadata,
    });
    displayOrder += 1;
  };

  addCandidate({
    type: CARPAN2_IMAGE_TYPES.MAIN,
    title: `${vehicle.modelName} 대표 이미지`,
    sourcePath: vehicle.imageLarge ?? vehicle.image,
    key: "main",
    metadata: { sourceField: vehicle.imageLarge ? "imageLarge" : "image" },
  });
  addCandidate({
    type: CARPAN2_IMAGE_TYPES.COVER,
    title: `${vehicle.modelName} 커버 이미지`,
    sourcePath: vehicle.cover,
    key: "cover",
    metadata: { sourceField: "cover" },
  });

  if (vehicle.modelItem) {
    for (const input of extractExteriorColors(vehicle, vehicle.modelItem)) addCandidate(input);
    for (const input of extractInteriorColors(vehicle, vehicle.modelItem)) addCandidate(input);
    for (const input of extractSpecImages(vehicle, vehicle.modelItem)) addCandidate(input);
    if (options.includeOptionImages) {
      for (const input of extractOptionImages(vehicle, vehicle.modelItem)) addCandidate(input);
    }
  }

  return candidates;
}

export function normalizeCarpan2ImageUrl(sourcePath: string | null): string | null {
  const value = sourcePath?.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/img/")) return `https://www.carpan.co.kr${value}`;
  return new URL(value.replace(/^\/+/, ""), CARPAN_IMAGE_BASE_URL).toString();
}

type CandidateInput = {
  readonly type: Carpan2ImageType;
  readonly title: string | null;
  readonly sourcePath: string | null;
  readonly key: string;
  readonly metadata: ImageMetadata;
};

function extractExteriorColors(
  vehicle: Carpan2ImageVehicle,
  modelItem: Carpan2ModelItem,
): readonly CandidateInput[] {
  const colorNames = new Map(vehicle.exteriorColors.map((color) => [color.colorId, color.name]));
  const inputs: CandidateInput[] = [];
  for (const [bodyId, colors] of Object.entries(modelItem.colorExt)) {
    for (const [colorId, color] of Object.entries(colors)) {
      const colorName = colorNames.get(colorId) ?? null;
      inputs.push({
        type: CARPAN2_IMAGE_TYPES.EXTERIOR_COLOR,
        title: colorName ? `외장 색상 ${colorName}` : "외장 색상",
        sourcePath: color.url,
        key: `exterior:${bodyId}:${colorId}`,
        metadata: { bodyId, colorId, colorName: colorName ?? "" },
      });
    }
  }
  return inputs;
}

function extractInteriorColors(
  vehicle: Carpan2ImageVehicle,
  modelItem: Carpan2ModelItem,
): readonly CandidateInput[] {
  const colorNames = new Map(vehicle.interiorColors.map((color) => [color.colorId, color.name]));
  const inputs: CandidateInput[] = [];
  for (const [colorId, images] of Object.entries(modelItem.colorInt)) {
    images.forEach((image, index) => {
      const title = image.subject ?? colorNames.get(colorId) ?? null;
      inputs.push({
        type: CARPAN2_IMAGE_TYPES.INTERIOR_COLOR,
        title: title ? `내장 색상 ${title}` : "내장 색상",
        sourcePath: image.url,
        key: `interior:${colorId}:${index}`,
        metadata: { colorId, colorName: title ?? "" },
      });
    });
  }
  return inputs;
}

function extractSpecImages(
  vehicle: Carpan2ImageVehicle,
  modelItem: Carpan2ModelItem,
): readonly CandidateInput[] {
  const itemKinds = buildItemKindMap(vehicle, modelItem);
  const inputs: CandidateInput[] = [];
  for (const [itemId, feature] of Object.entries(modelItem.item)) {
    const kindName = itemKinds.get(itemId);
    if (!kindName) continue;
    const type = classifySpecKind(kindName);
    if (!type) continue;
    for (const fileId of splitCsv(feature.photo)) {
      const file = modelItem.files[fileId];
      if (!file) continue;
      inputs.push({
        type,
        title: file.title ?? feature.name ?? kindName,
        sourcePath: file.image,
        key: `spec:${itemId}:${fileId}`,
        metadata: { itemId, fileId, kindName },
      });
    }
  }
  return sortSpecInputs(inputs);
}

function extractOptionImages(
  vehicle: Carpan2ImageVehicle,
  modelItem: Carpan2ModelItem,
): readonly CandidateInput[] {
  const inputs: CandidateInput[] = [];
  for (const [optionId, option] of Object.entries(modelItem.option)) {
    if (optionId === "list") continue;
    for (const fileId of splitCsv(option.photo)) {
      const file = modelItem.files[fileId];
      if (!file) continue;
      inputs.push({
        type: CARPAN2_IMAGE_TYPES.SPEC_OPTION,
        title: file.title,
        sourcePath: file.image,
        key: `option:${optionId}:${fileId}`,
        metadata: { optionId, fileId, sourceModelId: vehicle.modelId },
      });
    }
  }
  return inputs;
}

function buildItemKindMap(
  vehicle: Carpan2ImageVehicle,
  modelItem: Carpan2ModelItem,
): ReadonlyMap<string, string> {
  const itemKinds = new Map<string, string>();
  const modelKinds = modelItem.model[vehicle.modelId] ?? firstRecordValue(modelItem.model);
  if (!modelKinds) return itemKinds;

  for (const [kindId, itemIds] of Object.entries(modelKinds)) {
    if (kindId === "kind" || kindId === "star") continue;
    const kindName = toStringValue(modelItem.kind[kindId]);
    if (!kindName) continue;
    for (const itemId of splitCsv(itemIds)) itemKinds.set(itemId, kindName);
  }
  return itemKinds;
}

function classifySpecKind(kindName: string): Carpan2ImageType | null {
  if (kindName.includes("시트")) return CARPAN2_IMAGE_TYPES.SPEC_SEAT;
  if (kindName.includes("외관")) return CARPAN2_IMAGE_TYPES.SPEC_EXTERIOR;
  if (kindName.includes("내장") || kindName.includes("인테리어")) {
    return CARPAN2_IMAGE_TYPES.SPEC_INTERIOR;
  }
  return null;
}

function sortSpecInputs(inputs: readonly CandidateInput[]): readonly CandidateInput[] {
  return [...inputs].sort((left, right) => {
    const leftTypeOrder = specKindRank(left.type);
    const rightTypeOrder = specKindRank(right.type);
    if (leftTypeOrder !== rightTypeOrder) return leftTypeOrder - rightTypeOrder;
    return left.key.localeCompare(right.key, "ko-KR");
  });
}

function specKindRank(type: Carpan2ImageType): number {
  for (let index = 0; index < SPEC_KIND_ORDER.length; index++) {
    if (SPEC_KIND_ORDER[index] === type) return index;
  }
  return SPEC_KIND_ORDER.length;
}

function splitCsv(value: string | null): readonly string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function firstRecordValue<T>(record: Readonly<Record<string, T>>): T | null {
  const first = Object.values(record)[0];
  return first ?? null;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
