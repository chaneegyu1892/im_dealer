import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

const RESERVATION_DURATION_MS = 15 * 60 * 1000;

type ReservationDb = Pick<
  Prisma.TransactionClient,
  "$executeRawUnsafe" | "$queryRawUnsafe"
>;

export type VehicleImageStorageReservation = {
  readonly storagePath: string;
  readonly token: string;
};

export class VehicleImageStorageReservationError extends Error {
  readonly name = "VehicleImageStorageReservationError";

  constructor(readonly code: "RESERVATION_CONFLICT" | "RESERVATION_LOST") {
    super(code);
  }
}

export async function reserveVehicleImageStorage(
  db: ReservationDb,
  storagePath: string,
  now = new Date(),
): Promise<VehicleImageStorageReservation> {
  const token = randomUUID();
  const availableAt = new Date(now.getTime() + RESERVATION_DURATION_MS);
  const rows = await db.$queryRawUnsafe<readonly { readonly id: string }[]>(
    `INSERT INTO "VehicleImageStorageCleanup"
      ("id", "storagePath", "reason", "status", "reservationToken", "availableAt", "attempts", "createdAt", "updatedAt")
     VALUES ($1, $2, 'UPLOAD_ROLLBACK', 'RESERVED', $3, ($4::timestamptz AT TIME ZONE 'UTC'), 0, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
     ON CONFLICT ("storagePath") DO UPDATE SET
       "reason" = 'UPLOAD_ROLLBACK', "status" = 'RESERVED',
       "reservationToken" = EXCLUDED."reservationToken", "availableAt" = EXCLUDED."availableAt",
       "leaseToken" = NULL, "leaseExpiresAt" = NULL, "attempts" = 0,
       "lastError" = NULL, "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
     WHERE "VehicleImageStorageCleanup"."status" IN ('READY', 'DEAD')
     RETURNING "id"`,
    randomUUID(),
    storagePath,
    token,
    availableAt,
  );
  if (rows.length !== 1) {
    throw new VehicleImageStorageReservationError("RESERVATION_CONFLICT");
  }
  return { storagePath, token };
}

export async function releaseVehicleImageStorageReservation(
  db: ReservationDb,
  reservation: VehicleImageStorageReservation,
): Promise<void> {
  const released = await db.$executeRawUnsafe(
    `DELETE FROM "VehicleImageStorageCleanup"
     WHERE "storagePath" = $1 AND "reservationToken" = $2 AND "status" = 'RESERVED'`,
    reservation.storagePath,
    reservation.token,
  );
  if (released !== 1) {
    throw new VehicleImageStorageReservationError("RESERVATION_LOST");
  }
}

export async function markVehicleImageStorageReservationReady(
  db: ReservationDb,
  reservation: VehicleImageStorageReservation,
  now = new Date(),
): Promise<void> {
  const updated = await db.$executeRawUnsafe(
    `UPDATE "VehicleImageStorageCleanup" SET
       "status" = 'READY', "reservationToken" = NULL,
       "availableAt" = ($3::timestamptz AT TIME ZONE 'UTC'),
       "leaseToken" = NULL, "leaseExpiresAt" = NULL,
       "updatedAt" = ($3::timestamptz AT TIME ZONE 'UTC')
     WHERE "storagePath" = $1 AND "reservationToken" = $2 AND "status" = 'RESERVED'`,
    reservation.storagePath,
    reservation.token,
    now,
  );
  if (updated !== 1) {
    throw new VehicleImageStorageReservationError("RESERVATION_LOST");
  }
}
