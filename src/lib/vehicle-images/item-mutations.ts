import type { Prisma, VehicleImage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  VehicleImageEditInput,
  VehicleImageVersionInput,
  VehicleImageVisibilityInput,
} from "@/lib/validations/admin-vehicle-images";
import { getVehicleImageGroup, IMAGE_GROUP_TYPES } from "./groups";
import { applyImageEdit, editLockTypes } from "./ordering";
import {
  assertImageVersion,
  assertMutationReady,
  assertVehicleImageRevision,
  restoreImage,
  setImageVisibility,
  softDeleteImage,
} from "./policy";
import { advanceVehicleImageRevision } from "./revision";
import { withLockedVehicleImages } from "./transaction";

export class VehicleImageMutationTargetError extends Error {
  readonly name = "VehicleImageMutationTargetError";
  readonly code = "VEHICLE_IMAGE_NOT_FOUND";
  readonly status = 404;

  constructor() {
    super("VEHICLE_IMAGE_NOT_FOUND");
  }
}

type MutationResult = {
  readonly before: VehicleImage;
  readonly image: VehicleImage;
  readonly imageRevision: number;
  readonly vehicleUpdatedAt: Date;
};
type StateAction =
  | { readonly kind: "visibility"; readonly isVisible: boolean }
  | { readonly kind: "trash"; readonly deletedAt: Date }
  | { readonly kind: "restore" };

function currentGroupScope(imageId: string) {
  return {
    kind: "mutation_time_groups" as const,
    resolve: async (tx: Prisma.TransactionClient) => {
      const image = await tx.vehicleImage.findUnique({ where: { id: imageId } });
      if (!image) throw new VehicleImageMutationTargetError();
      return IMAGE_GROUP_TYPES[getVehicleImageGroup(image.type)];
    },
  };
}

async function loadOwnedImage(tx: Prisma.TransactionClient, vehicleId: string, imageId: string): Promise<VehicleImage> {
  const image = await tx.vehicleImage.findFirst({ where: { id: imageId, vehicleId } });
  if (!image) throw new VehicleImageMutationTargetError();
  return image;
}

async function mutateState(
  vehicleId: string,
  imageId: string,
  input: VehicleImageVersionInput,
  action: StateAction,
): Promise<MutationResult> {
  return withLockedVehicleImages({
    vehicleId,
    requestedImageIds: [imageId],
    lockScope: currentGroupScope(imageId),
  }, async (tx) => {
    const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    assertMutationReady(vehicle);
    assertVehicleImageRevision(vehicle.imageRevision, input.expectedImageRevision);
    const before = await loadOwnedImage(tx, vehicleId, imageId);
    assertImageVersion(before.updatedAt, input.expectedUpdatedAt);
    let data: Prisma.VehicleImageUpdateInput;
    switch (action.kind) {
      case "visibility":
        if (before.isVisible === action.isVisible) {
          return { before, image: before, imageRevision: vehicle.imageRevision, vehicleUpdatedAt: vehicle.updatedAt };
        }
        data = { isVisible: setImageVisibility(before, action.isVisible, vehicle.thumbnailImageId).isVisible };
        break;
      case "trash":
        data = { deletedAt: softDeleteImage(before, vehicle.thumbnailImageId, action.deletedAt).deletedAt };
        break;
      case "restore":
        data = { deletedAt: restoreImage(before).deletedAt };
        break;
    }
    const image = await tx.vehicleImage.update({ where: { id: imageId }, data });
    const revision = await advanceVehicleImageRevision(tx, vehicle);
    return { before, image, imageRevision: revision.imageRevision, vehicleUpdatedAt: revision.updatedAt };
  });
}

export async function listVehicleImages(vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      thumbnailImageId: true,
      thumbnailUrl: true,
      imageRevision: true,
      updatedAt: true,
      images: {
        orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          origin: true,
          title: true,
          storageUrl: true,
          sourceUrl: true,
          sourceKey: true,
          displayOrder: true,
          isVisible: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!vehicle) throw new VehicleImageMutationTargetError();
  return {
    thumbnailImageId: vehicle.thumbnailImageId,
    thumbnailUrl: vehicle.thumbnailUrl,
    imageRevision: vehicle.imageRevision,
    vehicleUpdatedAt: vehicle.updatedAt.toISOString(),
    images: vehicle.images.map((image) => ({
      id: image.id,
      type: image.type,
      origin: image.origin,
      title: image.title,
      storageUrl: image.storageUrl,
      sourceUrl: image.sourceUrl,
      sourceKey: image.sourceKey,
      displayOrder: image.displayOrder,
      isVisible: image.isVisible,
      deletedAt: image.deletedAt?.toISOString() ?? null,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
      isRepresentative: image.id === vehicle.thumbnailImageId,
    })),
  };
}

export async function editVehicleImage(
  vehicleId: string,
  imageId: string,
  input: VehicleImageEditInput,
): Promise<MutationResult> {
  return withLockedVehicleImages({
    vehicleId,
    requestedImageIds: [imageId],
    lockScope: {
      kind: "mutation_time_groups",
      resolve: async (tx) => {
        const image = await tx.vehicleImage.findUnique({ where: { id: imageId } });
        if (!image) throw new VehicleImageMutationTargetError();
        return editLockTypes(image.type, input.type);
      },
    },
  }, async (tx) => {
    const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    assertMutationReady(vehicle);
    assertVehicleImageRevision(vehicle.imageRevision, input.expectedImageRevision);
    const before = await loadOwnedImage(tx, vehicleId, imageId);
    if (before.deletedAt !== null) throw new VehicleImageMutationTargetError();
    assertImageVersion(before.updatedAt, input.expectedUpdatedAt);
    const changed = (input.title !== undefined && input.title !== before.title)
      || (input.type !== undefined && input.type !== before.type);
    if (!changed) return { before, image: before, imageRevision: vehicle.imageRevision, vehicleUpdatedAt: vehicle.updatedAt };
    const image = await applyImageEdit(tx, before, input);
    const revision = await advanceVehicleImageRevision(tx, vehicle);
    return { before, image, imageRevision: revision.imageRevision, vehicleUpdatedAt: revision.updatedAt };
  });
}

export function setVehicleImageVisibility(vehicleId: string, imageId: string, input: VehicleImageVisibilityInput) {
  return mutateState(vehicleId, imageId, input, { kind: "visibility", isVisible: input.isVisible });
}

export function trashVehicleImage(vehicleId: string, imageId: string, input: VehicleImageVersionInput) {
  return mutateState(vehicleId, imageId, input, { kind: "trash", deletedAt: new Date() });
}

export function restoreVehicleImage(vehicleId: string, imageId: string, input: VehicleImageVersionInput) {
  return mutateState(vehicleId, imageId, input, { kind: "restore" });
}
