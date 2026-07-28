import { randomUUID } from "node:crypto";
import type {
  Prisma,
  Vehicle,
  VehicleImage,
  VehicleImageStorageCleanup,
  VehicleImageStorageCleanupReason,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteVehicleImageObject } from "@/lib/supabase/storage";
import type { VehicleImageVersionInput } from "@/lib/validations/admin-vehicle-images";
import { getVehicleImageGroup, IMAGE_GROUP_TYPES } from "./groups";
import { VehicleImageMutationTargetError } from "./item-mutations";
import { assertImageVersion, assertMutationReady, assertVehicleImageRevision, purgeImage } from "./policy";
import { advanceVehicleImageRevision } from "./revision";
import { withLockedVehicleImages } from "./transaction";

const LEASE_DURATION_MS = 5 * 60 * 1000;
const RESERVATION_GRACE_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
// poison job이 무한 재시도하며 워커 슬롯을 소모하지 않도록, attempts가 임계치를 넘으면
// 터미널 상태(DEAD)로 전환하여 claimCleanup 후보에서 영구 제외한다.
const MAX_ATTEMPTS = 10;

type ProcessResult =
  | { readonly kind: "idle" }
  | { readonly kind: "deleted"; readonly storagePath: string }
  | { readonly kind: "deferred"; readonly storagePath: string; readonly reason: "active_owner" | "delete_failed" };

type ProcessOptions = {
  readonly now?: Date;
  readonly storagePath?: string;
  readonly deleteObject?: (path: string) => Promise<void>;
};

type RecoveryOptions = { readonly apply: boolean; readonly now?: Date };

export async function enqueueStorageCleanup(
  tx: Prisma.TransactionClient,
  storagePath: string,
  reason: VehicleImageStorageCleanupReason,
): Promise<boolean> {
  const rows = await tx.$queryRawUnsafe<readonly { readonly id: string }[]>(
    `INSERT INTO "VehicleImageStorageCleanup"
      ("id", "storagePath", "reason", "status", "availableAt", "attempts", "createdAt", "updatedAt")
     VALUES ($1, $2, $3::"VehicleImageStorageCleanupReason", 'READY', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), 0, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
     ON CONFLICT ("storagePath") DO UPDATE SET
       "reason" = EXCLUDED."reason", "status" = 'READY', "availableAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
       "reservationToken" = NULL, "leaseToken" = NULL, "leaseExpiresAt" = NULL,
       "lastError" = NULL, "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
     WHERE "VehicleImageStorageCleanup"."status" <> 'RESERVED'
     RETURNING "id"`,
    randomUUID(), storagePath, reason,
  );
  return rows.length === 1;
}

async function claimCleanup(now: Date, storagePath?: string): Promise<VehicleImageStorageCleanup | null> {
  const leaseToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<readonly VehicleImageStorageCleanup[]>(
      `WITH candidate AS (
         SELECT "id" FROM "VehicleImageStorageCleanup"
         WHERE (("status" = 'READY' AND "availableAt" <= ($1::timestamptz AT TIME ZONE 'UTC'))
           OR ("status" = 'PROCESSING' AND "leaseExpiresAt" <= ($1::timestamptz AT TIME ZONE 'UTC')))
           AND ($4::text IS NULL OR "storagePath" = $4)
         ORDER BY "availableAt", "id" FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE "VehicleImageStorageCleanup" AS cleanup SET
         "status" = 'PROCESSING', "leaseToken" = $2,
         "leaseExpiresAt" = ($3::timestamptz AT TIME ZONE 'UTC'),
         "updatedAt" = ($1::timestamptz AT TIME ZONE 'UTC')
       FROM candidate WHERE cleanup."id" = candidate."id" RETURNING cleanup.*`,
      now, leaseToken, leaseExpiresAt, storagePath ?? null,
    );
    return rows[0] ?? null;
  });
}

function retryAt(job: VehicleImageStorageCleanup, now: Date): Date {
  const exponent = Math.min(job.attempts, 7);
  return new Date(now.getTime() + Math.min(BASE_BACKOFF_MS * 2 ** exponent, MAX_BACKOFF_MS));
}

async function deferClaim(
  job: VehicleImageStorageCleanup,
  now: Date,
  lastError: string | null,
): Promise<void> {
  // 삭제가 반복 실패하여 attempts가 임계치에 도달하면 터미널 DEAD 상태로 전환한다.
  // active_owner 분기(lastError === null)는 일시적인 것이므로 attempts를 올리지 않고
  // DEAD 전환 대상에서 제외한다.
  const dead = lastError !== null && job.attempts + 1 >= MAX_ATTEMPTS;
  await prisma.vehicleImageStorageCleanup.updateMany({
    where: { id: job.id, status: "PROCESSING", leaseToken: job.leaseToken },
    data: {
      status: dead ? "DEAD" : "READY",
      // DEAD는 재시도 후보가 아니므로 availableAt를 갱신할 필요 없음.
      availableAt: dead ? job.availableAt : retryAt(job, now),
      leaseToken: null,
      leaseExpiresAt: null,
      ...(lastError === null ? {} : { attempts: { increment: 1 }, lastError: lastError.slice(0, 1000) }),
    },
  });
}

export async function processStorageCleanupOnce(options: ProcessOptions = {}): Promise<ProcessResult> {
  const now = options.now ?? new Date();
  const job = await claimCleanup(now, options.storagePath);
  if (!job) return { kind: "idle" };
  const owner = await prisma.vehicleImage.findFirst({
    where: {
      OR: [
        { adminStoragePath: job.storagePath },
        { listThumbnailStoragePath: job.storagePath },
      ],
    },
    select: { id: true },
  });
  if (owner) {
    await deferClaim(job, now, null);
    return { kind: "deferred", storagePath: job.storagePath, reason: "active_owner" };
  }
  try {
    await (options.deleteObject ?? deleteVehicleImageObject)(job.storagePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deferClaim(job, now, message);
    return { kind: "deferred", storagePath: job.storagePath, reason: "delete_failed" };
  }
  await prisma.vehicleImageStorageCleanup.deleteMany({
    where: { id: job.id, status: "PROCESSING", leaseToken: job.leaseToken },
  });
  return { kind: "deleted", storagePath: job.storagePath };
}

export async function recoverExpiredReservations(options: RecoveryOptions): Promise<{
  readonly eligible: number;
  readonly recovered: number;
}> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - RESERVATION_GRACE_MS);
  const found = await prisma.vehicleImageStorageCleanup.findMany({
    where: { status: "RESERVED", availableAt: { lte: cutoff } },
    orderBy: [{ availableAt: "asc" }, { id: "asc" }],
  });
  const eligible = found.filter((job) => job.availableAt <= cutoff);
  if (!options.apply) return { eligible: eligible.length, recovered: 0 };
  let recovered = 0;
  for (const job of eligible) {
    recovered += await prisma.$executeRawUnsafe(
      `UPDATE "VehicleImageStorageCleanup" AS cleanup SET
         "status" = 'READY', "reservationToken" = NULL,
         "availableAt" = ($2::timestamptz AT TIME ZONE 'UTC'),
         "leaseToken" = NULL, "leaseExpiresAt" = NULL,
         "updatedAt" = ($2::timestamptz AT TIME ZONE 'UTC')
       WHERE cleanup."id" = $1 AND cleanup."status" = 'RESERVED'
         AND cleanup."availableAt" <= ($3::timestamptz AT TIME ZONE 'UTC')
         AND NOT EXISTS (
           SELECT 1 FROM "VehicleImage" image
           WHERE image."adminStoragePath" = cleanup."storagePath"
              OR image."listThumbnailStoragePath" = cleanup."storagePath"
         )`,
      job.id, now, cutoff,
    );
  }
  return { eligible: eligible.length, recovered };
}

export async function readStorageCleanupState() {
  return prisma.vehicleImageStorageCleanup.findMany({
    select: {
      storagePath: true,
      reason: true,
      status: true,
      availableAt: true,
      leaseExpiresAt: true,
      attempts: true,
      lastError: true,
      updatedAt: true,
    },
    orderBy: [{ status: "asc" }, { availableAt: "asc" }, { storagePath: "asc" }],
  });
}

export async function purgeVehicleImage(
  vehicleId: string,
  imageId: string,
  input: VehicleImageVersionInput,
): Promise<{
  readonly before: VehicleImage;
  readonly storageCleanup: "deleted" | "deferred";
  readonly imageRevision: number;
  readonly vehicleUpdatedAt: Date;
}> {
  const mutation = await withLockedVehicleImages({
    vehicleId,
    requestedImageIds: [imageId],
    lockScope: {
      kind: "mutation_time_groups",
      resolve: async (tx) => {
        const image = await tx.vehicleImage.findUnique({ where: { id: imageId } });
        if (!image) throw new VehicleImageMutationTargetError();
        return IMAGE_GROUP_TYPES[getVehicleImageGroup(image.type)];
      },
    },
  }, async (tx) => {
    const vehicle = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    assertMutationReady(vehicle);
    assertVehicleImageRevision(vehicle.imageRevision, input.expectedImageRevision);
    const image = await tx.vehicleImage.findFirst({ where: { id: imageId, vehicleId } });
    if (!image) throw new VehicleImageMutationTargetError();
    assertImageVersion(image.updatedAt, input.expectedUpdatedAt);
    purgeImage(image, vehicle.thumbnailImageId);
    for (const storagePath of imageCleanupPaths(image)) {
      await enqueueStorageCleanup(tx, storagePath, "IMAGE_PURGE");
    }
    await tx.vehicleImage.delete({ where: { id: image.id } });
    const revision = await advanceVehicleImageRevision(tx, vehicle);
    return { before: image, imageRevision: revision.imageRevision, vehicleUpdatedAt: revision.updatedAt };
  });
  const cleanupPaths = imageCleanupPaths(mutation.before);
  if (cleanupPaths.length === 0) {
    return { ...mutation, storageCleanup: "deleted" };
  }
  const results = await Promise.all(
    cleanupPaths.map((storagePath) => processStorageCleanupOnce({ storagePath })),
  );
  return {
    ...mutation,
    storageCleanup: results.every((result) => result.kind === "deleted")
      ? "deleted"
      : "deferred",
  };
}

function imageCleanupPaths(image: {
  readonly adminStoragePath: string | null;
  readonly listThumbnailStoragePath: string | null;
}): readonly string[] {
  return [...new Set([
    image.adminStoragePath,
    image.listThumbnailStoragePath,
  ].filter((path): path is string => typeof path === "string" && path.length > 0))];
}

export async function deleteVehicleWithStorageCleanup(vehicleId: string): Promise<{
  readonly vehicle: Vehicle;
  readonly cleanupJobs: number;
}> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Vehicle" WHERE "id" = $1 FOR UPDATE', vehicleId);
    const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new VehicleImageMutationTargetError();
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "VehicleImage" WHERE "vehicleId" = $1 ORDER BY "id" FOR UPDATE',
      vehicleId,
    );
    const images = await tx.vehicleImage.findMany({
      where: { vehicleId },
      select: {
        adminStoragePath: true,
        listThumbnailStoragePath: true,
      },
      orderBy: { id: "asc" },
    });
    let cleanupJobs = 0;
    const storagePaths = new Set(images.flatMap((image) => imageCleanupPaths(image)));
    for (const storagePath of storagePaths) {
      if (await enqueueStorageCleanup(tx, storagePath, "VEHICLE_DELETE")) {
        cleanupJobs += 1;
      }
    }
    await tx.vehicle.delete({ where: { id: vehicleId } });
    return { vehicle, cleanupJobs };
  }, { isolationLevel: "Serializable" });
}
