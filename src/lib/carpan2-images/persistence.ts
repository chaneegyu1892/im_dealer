import { type Prisma, type PrismaClient } from "@prisma/client";
import { resolveDefaultRepresentative } from "../vehicle-images/policy";
import { advanceVehicleImageRevision } from "../vehicle-images/revision";
import {
  withLockedVehicleImages,
  type VehicleImageLockRequest,
} from "../vehicle-images/transaction";
import type { Carpan2ImageCandidate, ImageMetadata } from "./types";

export type ExistingCarpan2Image = {
  readonly id: string;
  readonly origin: "CARPAN2" | "ADMIN";
  readonly sourceUrl: string | null;
  readonly storageUrl: string;
};

export type CandidateWriteResult = "upserted" | "skipped";
export type RepresentativeFinalizeResult = "selected" | "preserved" | "missing";

export type Carpan2ImagePersistence = {
  readonly findExisting: (vehicleId: string, sourceKey: string) => Promise<ExistingCarpan2Image | null>;
  readonly applyMirroredCandidate: (input: {
    readonly vehicleId: string;
    readonly existingImageId: string | null;
    readonly candidate: Carpan2ImageCandidate;
    readonly storageUrl: string;
  }) => Promise<CandidateWriteResult>;
  readonly finalizeVehicleRepresentative: (vehicleId: string) => Promise<RepresentativeFinalizeResult>;
};

export type Carpan2ImageLockRunner = <TResult>(
  request: VehicleImageLockRequest,
  mutation: (tx: Prisma.TransactionClient) => Promise<TResult>,
) => Promise<TResult>;

export function createCarpan2ImagePersistence(
  prisma: PrismaClient,
  lockRunner: Carpan2ImageLockRunner = (request, mutation) => withLockedVehicleImages(request, mutation, prisma),
): Carpan2ImagePersistence {
  return {
    findExisting: async (vehicleId, sourceKey) => prisma.vehicleImage.findUnique({
      where: { vehicleId_sourceKey: { vehicleId, sourceKey } },
      select: { id: true, origin: true, sourceUrl: true, storageUrl: true },
    }),
    applyMirroredCandidate: async (input) => lockRunner(
      {
        vehicleId: input.vehicleId,
        requestedImageIds: input.existingImageId ? [input.existingImageId] : [],
        lockScope: { kind: "known_groups", groupTypes: [] },
      },
      async (tx) => applyMirroredCandidate(tx, input),
    ),
    finalizeVehicleRepresentative: async (vehicleId) => lockRunner(
      {
        vehicleId,
        requestedImageIds: [],
        lockScope: { kind: "known_groups", groupTypes: ["MAIN", "COVER"] },
      },
      async (tx) => finalizeVehicleRepresentative(tx, vehicleId),
    ),
  };
}

async function applyMirroredCandidate(
  tx: Prisma.TransactionClient,
  input: {
    readonly vehicleId: string;
    readonly candidate: Carpan2ImageCandidate;
    readonly storageUrl: string;
  },
): Promise<CandidateWriteResult> {
  const vehicle = await tx.vehicle.findUnique({
    where: { id: input.vehicleId },
    select: { id: true, thumbnailImageId: true, updatedAt: true },
  });
  const target = await tx.vehicleImage.findUnique({
    where: { vehicleId_sourceKey: { vehicleId: input.vehicleId, sourceKey: input.candidate.sourceKey } },
    select: { id: true, origin: true, sourceUrl: true, storageUrl: true },
  });
  if (!vehicle) return "skipped";
  if (target?.origin === "ADMIN") return "skipped";
  if (target && target.sourceUrl === input.candidate.sourceUrl && target.storageUrl === input.storageUrl) {
    return "skipped";
  }
  if (!target) {
    await tx.vehicleImage.create({
      data: {
        vehicleId: input.vehicleId,
        origin: "CARPAN2",
        type: input.candidate.type,
        title: input.candidate.title,
        storageUrl: input.storageUrl,
        sourceUrl: input.candidate.sourceUrl,
        sourceKey: input.candidate.sourceKey,
        displayOrder: input.candidate.displayOrder,
        metadata: toPrismaJson(input.candidate.metadata),
      },
    });
    await advanceVehicleImageRevision(tx, vehicle);
    return "upserted";
  }
  await tx.vehicleImage.update({
    where: { id: target.id },
    data: {
      sourceUrl: input.candidate.sourceUrl,
      storageUrl: input.storageUrl,
      metadata: toPrismaJson(input.candidate.metadata),
    },
  });
  await advanceVehicleImageRevision(
    tx,
    vehicle,
    vehicle.thumbnailImageId === target.id ? { thumbnailUrl: input.storageUrl } : {},
  );
  return "upserted";
}

async function finalizeVehicleRepresentative(
  tx: Prisma.TransactionClient,
  vehicleId: string,
): Promise<RepresentativeFinalizeResult> {
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, thumbnailImageId: true, thumbnailUrl: true, updatedAt: true },
  });
  if (!vehicle || vehicle.thumbnailImageId !== null || vehicle.thumbnailUrl.trim() !== "") {
    return "preserved";
  }
  const candidates = await tx.vehicleImage.findMany({
    where: {
      vehicleId,
      origin: "CARPAN2",
      type: { in: ["MAIN", "COVER"] },
      isVisible: true,
      deletedAt: null,
      storageUrl: { not: "" },
    },
    select: {
      id: true,
      type: true,
      origin: true,
      isVisible: true,
      deletedAt: true,
      storageUrl: true,
    },
    orderBy: { id: "asc" },
  });
  const selected = resolveDefaultRepresentative(candidates, "");
  if (selected.kind !== "image") return "missing";
  await advanceVehicleImageRevision(tx, vehicle, {
    thumbnailImageId: selected.imageId,
    thumbnailUrl: selected.url,
  });
  return "selected";
}

function toPrismaJson(metadata: ImageMetadata): Prisma.InputJsonObject {
  const output: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of Object.entries(metadata)) output[key] = value;
  return output;
}
