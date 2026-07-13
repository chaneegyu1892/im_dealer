import { randomUUID } from "node:crypto";
import type { VehicleImage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_UPLOAD_ALLOWED_MIME,
  ADMIN_UPLOAD_MAX_SIZE,
  uploadVehicleImageObject,
  VehicleImageStorageError,
} from "@/lib/supabase/storage";
import type { VehicleImageCreateInput } from "@/lib/validations/admin-vehicle-images";
import { getVehicleImageGroup, IMAGE_GROUP_TYPES } from "./groups";
import { assertMutationReady } from "./policy";
import { advanceVehicleImageRevision } from "./revision";
import { withLockedVehicleImages } from "./transaction";

const RESERVATION_DURATION_MS = 15 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const EXTENSION_BY_MIME = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export class VehicleImageUploadError extends Error {
  readonly name = "VehicleImageUploadError";
  readonly status: 400 | 409;

  constructor(
    readonly code: "EMPTY_FILE" | "FILE_TOO_LARGE" | "UNSUPPORTED_MIME" | "RESERVATION_LOST" | "RESERVATION_CONFLICT",
    cause?: unknown,
  ) {
    super(code, { cause });
    this.status = code === "EMPTY_FILE" || code === "FILE_TOO_LARGE" || code === "UNSUPPORTED_MIME" ? 400 : 409;
  }
}

export type VehicleImageUploadResult = {
  readonly image: VehicleImage;
  readonly imageRevision: number;
  readonly vehicleUpdatedAt: Date;
};

function futureReservation(now = new Date()): Date {
  return new Date(now.getTime() + RESERVATION_DURATION_MS);
}

function uploadIdentity(vehicleId: string, mime: string): { readonly path: string; readonly token: string } {
  const extension = EXTENSION_BY_MIME.get(mime);
  if (!extension) throw new VehicleImageUploadError("UNSUPPORTED_MIME");
  return {
    path: `admin/${vehicleId}/${randomUUID()}.${extension}`,
    token: randomUUID(),
  };
}

function assertFile(file: File): string {
  if (file.size === 0) throw new VehicleImageUploadError("EMPTY_FILE");
  if (file.size > ADMIN_UPLOAD_MAX_SIZE) throw new VehicleImageUploadError("FILE_TOO_LARGE");
  const mime = file.type.toLowerCase();
  if (!ADMIN_UPLOAD_ALLOWED_MIME.has(mime)) throw new VehicleImageUploadError("UNSUPPORTED_MIME");
  return mime;
}

export async function markUploadRollbackReady(path: string, token: string): Promise<void> {
  const result = await prisma.vehicleImageStorageCleanup.updateMany({
    where: { storagePath: path, reservationToken: token, status: "RESERVED" },
    data: {
      status: "READY",
      availableAt: new Date(),
      reservationToken: null,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  if (result.count === 1) return;
  let durable = await prisma.vehicleImageStorageCleanup.findUnique({ where: { storagePath: path } });
  if (!durable) {
    try {
      durable = await prisma.vehicleImageStorageCleanup.create({
        data: {
          storagePath: path,
          reason: "UPLOAD_ROLLBACK",
          status: "READY",
          reservationToken: null,
          availableAt: new Date(),
        },
      });
    } catch (cause) {
      durable = await prisma.vehicleImageStorageCleanup.findUnique({ where: { storagePath: path } });
      if (!durable) throw new VehicleImageUploadError("RESERVATION_CONFLICT", cause);
    }
  }
  throw new VehicleImageUploadError("RESERVATION_CONFLICT");
}

async function deleteRejectedUploadReservation(path: string, token: string): Promise<void> {
  const result = await prisma.vehicleImageStorageCleanup.deleteMany({
    where: { storagePath: path, reservationToken: token, status: "RESERVED" },
  });
  if (result.count !== 1) throw new VehicleImageUploadError("RESERVATION_CONFLICT");
}

export async function uploadVehicleImage(
  vehicleId: string,
  input: VehicleImageCreateInput,
): Promise<VehicleImageUploadResult> {
  const mime = assertFile(input.file);
  const identity = uploadIdentity(vehicleId, mime);
  await prisma.vehicleImageStorageCleanup.create({
    data: {
      storagePath: identity.path,
      reason: "UPLOAD_ROLLBACK",
      status: "RESERVED",
      reservationToken: identity.token,
      availableAt: futureReservation(),
    },
  });

  let heartbeatFailure: unknown = null;
  const heartbeat = setInterval(() => {
    void prisma.vehicleImageStorageCleanup.updateMany({
      where: { storagePath: identity.path, reservationToken: identity.token, status: "RESERVED" },
      data: { availableAt: futureReservation() },
    }).then((result) => {
      if (result.count !== 1) heartbeatFailure = new VehicleImageUploadError("RESERVATION_LOST");
    }).catch((error: unknown) => {
      heartbeatFailure = error;
    });
  }, HEARTBEAT_INTERVAL_MS);

  let storageUrl: string;
  try {
    storageUrl = await uploadVehicleImageObject({ path: identity.path, file: input.file, contentType: mime });
  } catch (error) {
    clearInterval(heartbeat);
    if (error instanceof VehicleImageStorageError && !error.objectMayExist) {
      await deleteRejectedUploadReservation(identity.path, identity.token);
    } else {
      await markUploadRollbackReady(identity.path, identity.token);
    }
    throw error;
  }
  clearInterval(heartbeat);

  try {
    if (heartbeatFailure !== null) throw heartbeatFailure;
    const image = await withLockedVehicleImages({
      vehicleId,
      requestedImageIds: [],
      lockScope: { kind: "known_groups", groupTypes: IMAGE_GROUP_TYPES[getVehicleImageGroup(input.type)] },
    }, async (tx) => {
      const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
      assertMutationReady(vehicle);
      const last = await tx.vehicleImage.findFirst({
        where: { vehicleId, deletedAt: null, type: { in: [...IMAGE_GROUP_TYPES[getVehicleImageGroup(input.type)]] } },
        orderBy: [{ displayOrder: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      });
      const created = await tx.vehicleImage.create({
        data: {
          vehicleId,
          type: input.type,
          origin: "ADMIN",
          title: input.title,
          storageUrl,
          sourceUrl: null,
          sourceKey: `admin:${identity.path}`,
          adminStoragePath: identity.path,
          displayOrder: (last?.displayOrder ?? -1) + 1,
          isVisible: input.isVisible,
        },
      });
      const released = await tx.vehicleImageStorageCleanup.deleteMany({
        where: { storagePath: identity.path, reservationToken: identity.token, status: "RESERVED" },
      });
      if (released.count !== 1) throw new VehicleImageUploadError("RESERVATION_LOST");
      const revision = await advanceVehicleImageRevision(tx, vehicle);
      return { image: created, imageRevision: revision.imageRevision, vehicleUpdatedAt: revision.updatedAt };
    });
    return image;
  } catch (error) {
    await markUploadRollbackReady(identity.path, identity.token);
    throw error;
  }
}
