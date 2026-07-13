import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AppliedVehicleBackfill,
  BackfillStore,
  BackfillVehicle,
  VehicleBackfillPlan,
} from "./backfill-types";
import { isCanonicalMirroredUrl } from "./backfill-plan";
import { advanceVehicleImageRevision } from "./revision";
import { isRetryableTransactionError } from "./transaction-retry";

const MAX_ATTEMPTS = 3;

type ProjectionReadback = {
  readonly checked: number;
  readonly migrationRequired: number;
  readonly samples: readonly { readonly id: string; readonly name: string }[];
};

export type BackfillProjectionRow = {
  readonly vehicleId: string;
  readonly thumbnailUrl: string;
  readonly thumbnailImageId: string | null;
  readonly thumbnailImage: {
    readonly id: string;
    readonly vehicleId: string;
    readonly type: string;
    readonly origin: "CARPAN2" | "ADMIN";
    readonly storageUrl: string;
    readonly isVisible: boolean;
    readonly deletedAt: Date | null;
  } | null;
};

type BackfillLockClient = {
  readonly $queryRawUnsafe: (
    query: string,
    ...values: unknown[]
  ) => Promise<readonly { readonly id: string }[]>;
};

export class BackfillVehicleMissingError extends Error {
  readonly name = "BackfillVehicleMissingError";

  constructor(readonly vehicleId: string) {
    super(`Backfill vehicle disappeared: ${vehicleId}`);
  }
}

export class BackfillTransactionConflictError extends Error {
  readonly name = "BackfillTransactionConflictError";

  constructor(readonly vehicleId: string, cause: unknown) {
    super(`Backfill transaction conflict exhausted: ${vehicleId}`, { cause });
  }
}

export async function lockBackfillRows(client: BackfillLockClient, vehicleId: string): Promise<void> {
  const vehicles = await client.$queryRawUnsafe(
    'SELECT "id" FROM "Vehicle" WHERE "id" = $1 FOR UPDATE',
    vehicleId,
  );
  if (vehicles.length !== 1) throw new BackfillVehicleMissingError(vehicleId);
  await client.$queryRawUnsafe(
    'SELECT "id" FROM "VehicleImage" WHERE "vehicleId" = $1 ORDER BY "id" ASC FOR UPDATE',
    vehicleId,
  );
}

async function loadVehicle(
  client: PrismaClient | Prisma.TransactionClient,
  vehicleId: string,
): Promise<BackfillVehicle> {
  const vehicle = await client.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      thumbnailImageId: true,
      imageRevision: true,
      updatedAt: true,
      imageUrls: true,
      images: {
        select: {
          id: true,
          type: true,
          origin: true,
          title: true,
          storageUrl: true,
          sourceUrl: true,
          sourceKey: true,
          adminStoragePath: true,
          displayOrder: true,
          isVisible: true,
          deletedAt: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!vehicle) throw new BackfillVehicleMissingError(vehicleId);
  return vehicle;
}

async function applyPlan(
  tx: Prisma.TransactionClient,
  snapshot: BackfillVehicle,
  plan: VehicleBackfillPlan,
): Promise<number> {
  const imageIds = new Map(snapshot.images.map((image) => [image.sourceKey, image.id]));
  let writes = 0;
  for (const create of plan.creates) {
    const created = await tx.vehicleImage.create({ data: { vehicleId: snapshot.id, ...create } });
    imageIds.set(create.sourceKey, created.id);
    writes += 1;
  }
  if (!plan.vehicleUpdate && writes === 0) return 0;
  if (!plan.vehicleUpdate) {
    await advanceVehicleImageRevision(tx, snapshot);
    return writes;
  }
  const selectedId = plan.selection.kind === "legacy"
    ? imageIds.get(plan.selection.sourceKey)
    : plan.selection.imageId;
  if (!selectedId) throw new BackfillVehicleMissingError(snapshot.id);
  await advanceVehicleImageRevision(tx, snapshot, {
    thumbnailImageId: selectedId,
    thumbnailUrl: plan.selection.url,
  });
  return writes + 1;
}

async function runLocked<TResult>(
  prisma: PrismaClient,
  vehicleId: string,
  operation: (tx: Prisma.TransactionClient, snapshot: BackfillVehicle) => Promise<TResult>,
): Promise<TResult> {
  let conflict: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockBackfillRows(tx, vehicleId);
        const snapshot = await loadVehicle(tx, vehicleId);
        return operation(tx, snapshot);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error;
      conflict = error;
    }
  }
  throw new BackfillTransactionConflictError(vehicleId, conflict);
}

async function applyLocked(
  prisma: PrismaClient,
  vehicleId: string,
  planner: (snapshot: BackfillVehicle) => VehicleBackfillPlan,
): Promise<AppliedVehicleBackfill> {
  return runLocked(prisma, vehicleId, async (tx, snapshot) => {
    const plan = planner(snapshot);
    return { plan, writes: await applyPlan(tx, snapshot, plan) };
  });
}

export function createPrismaBackfillStore(prisma: PrismaClient): BackfillStore {
  return {
    listVehicleIds: async () => {
      const vehicles = await prisma.vehicle.findMany({ select: { id: true }, orderBy: { id: "asc" } });
      return vehicles.map((vehicle) => vehicle.id);
    },
    planVehicle: (vehicleId, planner) => runLocked(
      prisma,
      vehicleId,
      async (_tx, snapshot) => planner(snapshot),
    ),
    applyVehicle: (vehicleId, planner) => applyLocked(prisma, vehicleId, planner),
  };
}

export function isEligibleBackfillProjection(row: BackfillProjectionRow): boolean {
  const image = row.thumbnailImage;
  if (row.thumbnailUrl.trim() === "" || row.thumbnailImageId === null || image === null) return false;
  if (image.id !== row.thumbnailImageId
    || image.vehicleId !== row.vehicleId
    || !image.isVisible
    || image.deletedAt !== null
    || image.storageUrl.trim() === ""
    || image.storageUrl !== row.thumbnailUrl) return false;
  if (image.origin === "ADMIN") return image.type === "MAIN";
  if (image.type !== "MAIN" && image.type !== "COVER") return false;
  return isCanonicalMirroredUrl(image.storageUrl);
}

export async function readBackfillProjection(prisma: PrismaClient): Promise<ProjectionReadback> {
  const vehicles = await prisma.vehicle.findMany({
    where: { thumbnailUrl: { not: "" } },
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      thumbnailImageId: true,
      thumbnailImage: { select: { id: true, vehicleId: true, type: true, origin: true, storageUrl: true, isVisible: true, deletedAt: true } },
    },
    orderBy: { id: "asc" },
  });
  const checked = vehicles.filter((vehicle) => vehicle.thumbnailUrl.trim() !== "");
  const invalid = checked.filter((vehicle) => !isEligibleBackfillProjection({
    vehicleId: vehicle.id,
    thumbnailUrl: vehicle.thumbnailUrl,
    thumbnailImageId: vehicle.thumbnailImageId,
    thumbnailImage: vehicle.thumbnailImage,
  }));
  return {
    checked: checked.length,
    migrationRequired: invalid.length,
    samples: invalid.slice(0, 25).map((vehicle) => ({ id: vehicle.id, name: vehicle.name })),
  };
}
