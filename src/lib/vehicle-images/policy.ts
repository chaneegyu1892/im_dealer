import type { VehicleImageTypeValue } from "./groups";

export type VehicleImageOriginValue = "CARPAN2" | "ADMIN";

type ImageState = {
  readonly id: string;
  readonly isVisible: boolean;
  readonly deletedAt: Date | null;
};

type PurgeableImage = ImageState & {
  readonly origin: VehicleImageOriginValue;
};

type RepresentativeCandidate = ImageState & {
  readonly type: VehicleImageTypeValue;
  readonly origin: VehicleImageOriginValue;
  readonly storageUrl: string;
};

type LegacyMatchCandidate = RepresentativeCandidate & {
  readonly sourceUrl: string | null;
};

export type VehicleImagePolicyCode =
  | "REPRESENTATIVE_IMAGE_MUTATION_FORBIDDEN"
  | "REPRESENTATIVE_IMAGE_INELIGIBLE"
  | "REPRESENTATIVE_MIGRATION_REQUIRED"
  | "CARPAN2_IMAGE_PURGE_FORBIDDEN"
  | "IMAGE_ALREADY_TRASHED"
  | "IMAGE_NOT_TRASHED"
  | "STALE_IMAGE_STATE"
  | "STALE_IMAGE_REVISION"
  | "STALE_VEHICLE_STATE";

export class VehicleImagePolicyError extends Error {
  readonly name = "VehicleImagePolicyError";
  readonly status = 409;

  constructor(readonly code: VehicleImagePolicyCode) {
    super(code);
  }
}

export function assertMutationReady(vehicle: {
  readonly thumbnailImageId: string | null;
  readonly thumbnailUrl: string;
}): void {
  if (vehicle.thumbnailImageId === null && vehicle.thumbnailUrl.trim() !== "") {
    throw new VehicleImagePolicyError("REPRESENTATIVE_MIGRATION_REQUIRED");
  }
}

export function assertRepresentativeEligible(image: ImageState): void {
  if (!image.isVisible || image.deletedAt !== null) {
    throw new VehicleImagePolicyError("REPRESENTATIVE_IMAGE_INELIGIBLE");
  }
}

function assertRepresentativeMutation(imageId: string, representativeId: string | null): void {
  if (imageId === representativeId) {
    throw new VehicleImagePolicyError("REPRESENTATIVE_IMAGE_MUTATION_FORBIDDEN");
  }
}

export function setImageVisibility<T extends ImageState>(
  image: T,
  isVisible: boolean,
  representativeId: string | null,
): T & { readonly isVisible: boolean } {
  if (image.deletedAt !== null) throw new VehicleImagePolicyError("IMAGE_ALREADY_TRASHED");
  if (!isVisible) assertRepresentativeMutation(image.id, representativeId);
  return { ...image, isVisible };
}

export function softDeleteImage<T extends ImageState>(
  image: T,
  representativeId: string | null,
  deletedAt: Date,
): T & { readonly deletedAt: Date } {
  if (image.deletedAt !== null) throw new VehicleImagePolicyError("IMAGE_ALREADY_TRASHED");
  assertRepresentativeMutation(image.id, representativeId);
  return { ...image, deletedAt };
}

export function restoreImage<T extends ImageState>(
  image: T,
): T & { readonly deletedAt: null } {
  if (image.deletedAt === null) throw new VehicleImagePolicyError("IMAGE_NOT_TRASHED");
  return { ...image, deletedAt: null };
}

export function purgeImage(image: PurgeableImage, representativeId: string | null): {
  readonly id: string;
  readonly purge: true;
} {
  assertRepresentativeMutation(image.id, representativeId);
  if (image.origin === "CARPAN2") {
    throw new VehicleImagePolicyError("CARPAN2_IMAGE_PURGE_FORBIDDEN");
  }
  if (image.deletedAt === null) throw new VehicleImagePolicyError("IMAGE_NOT_TRASHED");
  return { id: image.id, purge: true };
}

export function resolveDefaultRepresentative(
  images: readonly RepresentativeCandidate[],
  existingUrl: string,
):
  | { readonly kind: "image"; readonly imageId: string; readonly url: string }
  | { readonly kind: "existing"; readonly url: string }
  | { readonly kind: "missing" } {
  const eligible = images.filter((image) =>
    image.origin === "CARPAN2"
    && image.isVisible
    && image.deletedAt === null
    && image.storageUrl.trim() !== ""
    && (image.type === "COVER" || image.type === "MAIN"));
  const selected = eligible.toSorted((left, right) => {
    const typeOrder = Number(left.type === "MAIN") - Number(right.type === "MAIN");
    return typeOrder || left.id.localeCompare(right.id);
  })[0];
  if (selected) return { kind: "image", imageId: selected.id, url: selected.storageUrl.trim() };
  const trimmed = existingUrl.trim();
  return trimmed === "" ? { kind: "missing" } : { kind: "existing", url: trimmed };
}

export function classifyLegacyRepresentative(
  thumbnailUrl: string,
  images: readonly LegacyMatchCandidate[],
):
  | { readonly kind: "blank" }
  | { readonly kind: "carpan_managed"; readonly imageId: string }
  | { readonly kind: "custom"; readonly url: string } {
  const url = thumbnailUrl.trim();
  if (url === "") return { kind: "blank" };
  const match = images
    .filter((image) => image.origin === "CARPAN2" && (image.type === "COVER" || image.type === "MAIN"))
    .toSorted((left, right) => {
      const typeOrder = Number(left.type === "MAIN") - Number(right.type === "MAIN");
      return typeOrder || left.id.localeCompare(right.id);
    })
    .find((image) => image.storageUrl.trim() === url || image.sourceUrl?.trim() === url);
  return match ? { kind: "carpan_managed", imageId: match.id } : { kind: "custom", url };
}

export function assertImageVersion(actual: Date, expected: string): void {
  if (actual.getTime() !== new Date(expected).getTime()) {
    throw new VehicleImagePolicyError("STALE_IMAGE_STATE");
  }
}

export function assertVehicleVersion(actual: Date, expected: string): void {
  if (actual.getTime() !== new Date(expected).getTime()) {
    throw new VehicleImagePolicyError("STALE_VEHICLE_STATE");
  }
}

export function assertVehicleImageRevision(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new VehicleImagePolicyError("STALE_IMAGE_REVISION");
  }
}
