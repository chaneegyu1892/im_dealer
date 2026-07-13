import { createHash } from "node:crypto";
import type {
  BackfillImage,
  BackfillSelection,
  BackfillVehicle,
  LegacyImageCreate,
  VehicleBackfillPlan,
} from "./backfill-types";

export class LegacyImageConflictError extends Error {
  readonly name = "LegacyImageConflictError";

  constructor(readonly vehicleId: string, readonly sourceKey: string) {
    super(`Legacy image key conflicts with an incompatible row: ${vehicleId}/${sourceKey}`);
  }
}

function normalized(value: string | null): string {
  return value?.trim() ?? "";
}

export function legacySourceKey(url: string): string {
  return `legacy:url:${createHash("sha256").update(url.trim()).digest("hex")}`;
}

function isManagedCandidate(image: BackfillImage): boolean {
  return image.origin === "CARPAN2" && (image.type === "COVER" || image.type === "MAIN");
}

export function isCanonicalMirroredUrl(value: string): boolean {
  if (value === "" || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  } catch (error) {
    if (error instanceof URIError) return false;
    throw error;
  }
  return parsed.protocol === "https:"
    && parsed.hostname !== ""
    && parsed.username === ""
    && parsed.password === ""
    && !/[\u0000-\u001f\u007f]/.test(decodedPath);
}

function activeManagedCandidates(images: readonly BackfillImage[]): readonly BackfillImage[] {
  return images.filter((image) => isManagedCandidate(image)
    && image.deletedAt === null
    && image.isVisible);
}

function isEligibleManagedCandidate(image: BackfillImage): boolean {
  return isManagedCandidate(image)
    && image.deletedAt === null
    && image.isVisible
    && isCanonicalMirroredUrl(image.storageUrl);
}

function eligibleCandidates(images: readonly BackfillImage[]): readonly BackfillImage[] {
  return images
    .filter(isEligibleManagedCandidate)
    .toSorted((left, right) => {
      const typeOrder = Number(left.type === "MAIN") - Number(right.type === "MAIN");
      return typeOrder || left.displayOrder - right.displayOrder || left.id.localeCompare(right.id);
    });
}

function classify(vehicle: BackfillVehicle): "blank" | "managed" | "custom" {
  const current = normalized(vehicle.thumbnailUrl);
  if (current === "") return "blank";
  const linked = vehicle.images.find((image) => image.id === vehicle.thumbnailImageId);
  if (linked?.origin === "ADMIN" && normalized(linked.storageUrl) === current) return "custom";
  const managedUrls = vehicle.images
    .filter(isManagedCandidate)
    .flatMap((image) => [normalized(image.sourceUrl), normalized(image.storageUrl)])
    .filter((url) => url !== "");
  return managedUrls.includes(current) ? "managed" : "custom";
}

function validateLegacyRow(
  vehicleId: string,
  image: BackfillImage,
  url: string,
  displayOrder: number,
): void {
  if (image.origin !== "ADMIN"
    || image.type !== "MAIN"
    || image.storageUrl !== url
    || image.sourceUrl !== url
    || image.adminStoragePath !== null
    || image.displayOrder !== displayOrder
    || !image.isVisible
    || image.deletedAt !== null) {
    throw new LegacyImageConflictError(vehicleId, image.sourceKey);
  }
}

function legacyCreate(url: string, title: string, displayOrder: number): LegacyImageCreate {
  return {
    type: "MAIN",
    origin: "ADMIN",
    title,
    storageUrl: url,
    sourceUrl: url,
    sourceKey: legacySourceKey(url),
    adminStoragePath: null,
    displayOrder,
    isVisible: true,
  };
}

function adoptionPlan(vehicle: BackfillVehicle, customUrl: string | null): {
  readonly creates: readonly LegacyImageCreate[];
  readonly customSelection: BackfillSelection | null;
  readonly blockedLegacyUrlCount: number;
} {
  const creates: LegacyImageCreate[] = [];
  let blockedLegacyUrlCount = 0;
  const bySourceKey = new Map(vehicle.images.map((image) => [image.sourceKey, image]));
  const linked = customUrl === null
    ? null
    : vehicle.images.find((image) => image.id === vehicle.thumbnailImageId && normalized(image.storageUrl) === customUrl) ?? null;
  let customSelection: BackfillSelection | null = linked === null ? null : { kind: "existing", imageId: linked.id, url: customUrl ?? "" };
  const imageUrls = [...new Set(vehicle.imageUrls.map(normalized).filter((url) => url !== ""))];
  const orderByUrl = new Map(imageUrls.map((url, index) => [url, index]));
  const galleryOffset = customUrl !== null && !orderByUrl.has(customUrl) ? 1 : 0;
  if (customUrl !== null && linked?.sourceKey === legacySourceKey(customUrl)) {
    validateLegacyRow(vehicle.id, linked, customUrl, orderByUrl.get(customUrl) ?? 0);
  }

  if (customUrl !== null && linked === null) {
    const key = legacySourceKey(customUrl);
    const existing = bySourceKey.get(key);
    const displayOrder = orderByUrl.get(customUrl) ?? 0;
    if (existing) validateLegacyRow(vehicle.id, existing, customUrl, displayOrder);
    if (!existing) creates.push(legacyCreate(customUrl, "기존 대표 이미지", displayOrder));
    customSelection = existing
      ? { kind: "existing", imageId: existing.id, url: customUrl }
      : { kind: "legacy", sourceKey: key, url: customUrl };
  }

  for (const [url, index] of orderByUrl) {
    if (url === customUrl) continue;
    const managedMatches = vehicle.images.filter((image) => isManagedCandidate(image)
      && (normalized(image.sourceUrl) === url || normalized(image.storageUrl) === url));
    if (managedMatches.some(isEligibleManagedCandidate)) continue;
    if (managedMatches.length > 0) {
      blockedLegacyUrlCount += 1;
      continue;
    }
    const key = legacySourceKey(url);
    const existing = bySourceKey.get(key);
    const displayOrder = index + galleryOffset;
    if (existing) validateLegacyRow(vehicle.id, existing, url, displayOrder);
    if (!existing) creates.push(legacyCreate(url, `기존 이미지 ${index + 1}`, displayOrder));
  }
  return { creates, customSelection, blockedLegacyUrlCount };
}

export function planVehicleBackfill(vehicle: BackfillVehicle): VehicleBackfillPlan {
  const currentUrl = normalized(vehicle.thumbnailUrl);
  const classification = classify(vehicle);
  const customUrl = classification === "custom" ? currentUrl : null;
  const adoption = adoptionPlan(vehicle, customUrl);
  const activeManaged = activeManagedCandidates(vehicle.images);
  const candidate = eligibleCandidates(vehicle.images)[0];
  const selection: BackfillSelection = adoption.customSelection
    ?? (candidate
      ? { kind: "existing", imageId: candidate.id, url: candidate.storageUrl }
      : { kind: "preserve", imageId: vehicle.thumbnailImageId, url: currentUrl });
  const vehicleUpdate = selection.kind === "legacy"
    || (selection.kind === "existing"
      && (selection.imageId !== vehicle.thumbnailImageId || selection.url !== vehicle.thumbnailUrl));
  const missing = classification !== "custom" && candidate === undefined;
  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    classification,
    creates: adoption.creates,
    selection,
    vehicleUpdate,
    preservedCustom: classification === "custom",
    missing,
    invalidCandidateCount: activeManaged.filter((image) => !isCanonicalMirroredUrl(image.storageUrl)).length,
    blockedLegacyUrlCount: adoption.blockedLegacyUrlCount,
    migrationRequired: currentUrl !== ""
      && selection.kind === "preserve"
      && selection.imageId === null,
  };
}
