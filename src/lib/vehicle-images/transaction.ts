import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { VehicleImageTypeValue } from "./groups";
import { isRetryableTransactionError } from "./transaction-retry";

export { isRetryableTransactionError } from "./transaction-retry";

const MAX_TRANSACTION_ATTEMPTS = 3;

export type VehicleImageLockRequest = {
  readonly vehicleId: string;
  readonly requestedImageIds: readonly string[];
  readonly lockScope:
    | { readonly kind: "known_groups"; readonly groupTypes: readonly VehicleImageTypeValue[] }
    | {
      readonly kind: "mutation_time_groups";
      readonly resolve: (tx: Prisma.TransactionClient) => Promise<readonly VehicleImageTypeValue[]>;
    };
};

type TransactionClient = Pick<PrismaClient, "$transaction">;

export class VehicleImageLockTargetError extends Error {
  readonly name = "VehicleImageLockTargetError";
  readonly code = "IMAGE_LOCK_TARGET_NOT_FOUND";
  readonly status = 404;

  constructor() {
    super("IMAGE_LOCK_TARGET_NOT_FOUND");
  }
}

export class ConcurrentImageMutationError extends Error {
  readonly name = "ConcurrentImageMutationError";
  readonly code = "CONCURRENT_IMAGE_MUTATION";
  readonly status = 409;

  constructor(cause: unknown) {
    super("CONCURRENT_IMAGE_MUTATION", { cause });
  }
}

async function lockRows(tx: Prisma.TransactionClient, request: VehicleImageLockRequest): Promise<void> {
  const vehicles = await tx.$queryRawUnsafe<readonly { readonly id: string }[]>(
    'SELECT "id" FROM "Vehicle" WHERE "id" = $1 FOR UPDATE',
    request.vehicleId,
  );
  if (vehicles.length !== 1) throw new VehicleImageLockTargetError();
  const groupTypes = request.lockScope.kind === "known_groups"
    ? request.lockScope.groupTypes
    : await request.lockScope.resolve(tx);
  const requestedImageIds = [...new Set(request.requestedImageIds)].sort();
  const images = await tx.$queryRawUnsafe<readonly { readonly id: string }[]>(
    'SELECT "id" FROM "VehicleImage" WHERE "vehicleId" = $1 AND ("id" = ANY($2::text[]) OR ("deletedAt" IS NULL AND "type" = ANY($3::"VehicleImageType"[]))) ORDER BY "id" ASC FOR UPDATE',
    request.vehicleId,
    requestedImageIds,
    [...new Set(groupTypes)].sort(),
  );
  const lockedIds = new Set(images.map((image) => image.id));
  if (requestedImageIds.some((id) => !lockedIds.has(id))) {
    throw new VehicleImageLockTargetError();
  }
}

export async function withLockedVehicleImages<TResult>(
  request: VehicleImageLockRequest,
  mutation: (tx: Prisma.TransactionClient) => Promise<TResult>,
  client: TransactionClient = prisma,
): Promise<TResult> {
  let lastConflict: unknown = null;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(async (tx) => {
        await lockRows(tx, request);
        return mutation(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error;
      lastConflict = error;
    }
  }
  throw new ConcurrentImageMutationError(lastConflict);
}
