import { PrismaClient, type Prisma } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { pathToFileURL } from "node:url";
import { backfillVehicleListThumbnails } from "../src/lib/vehicle-images/list-thumbnail-backfill";
import { VEHICLE_LIST_THUMBNAIL_CONTENT_TYPE } from "../src/lib/vehicle-images/list-thumbnail";
import { VEHICLE_IMAGE_BUCKET } from "../src/lib/vehicle-image-mirror";
import {
  markVehicleImageStorageReservationReady,
  releaseVehicleImageStorageReservation,
  reserveVehicleImageStorage,
} from "../src/lib/vehicle-images/storage-reservation";

const APPLY_CONFIRMATION = "vehicle-list-thumbnail-v1";

export type VehicleListThumbnailBackfillCliOptions = {
  readonly apply: boolean;
  readonly concurrency: number;
  readonly limit: number | null;
};

export class VehicleListThumbnailBackfillCliError extends Error {
  readonly name = "VehicleListThumbnailBackfillCliError";
}

export function buildVehicleListThumbnailBackfillCasWhere(input: {
  readonly imageId: string;
  readonly expectedStorageUrl: string;
  readonly expectedAdminStoragePath: string | null;
}): Prisma.VehicleImageWhereInput {
  return {
    id: input.imageId,
    storageUrl: input.expectedStorageUrl,
    adminStoragePath: input.expectedAdminStoragePath,
    deletedAt: null,
    OR: [
      { listThumbnailUrl: null },
      { listThumbnailStoragePath: null },
    ],
  };
}

export function parseVehicleListThumbnailBackfillArgs(
  args: readonly string[],
): VehicleListThumbnailBackfillCliOptions {
  let action: "dry-run" | "apply" = "dry-run";
  let explicitAction: "dry-run" | "apply" | null = null;
  let confirmation: string | null = null;
  let concurrency = 4;
  let limit: number | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run" || argument === "--apply") {
      const requested = argument === "--apply" ? "apply" : "dry-run";
      if (explicitAction !== null && explicitAction !== requested) {
        throw new VehicleListThumbnailBackfillCliError(
          "choose exactly one of --dry-run or --apply",
        );
      }
      explicitAction = requested;
      action = requested;
    } else if (argument === "--confirm") {
      confirmation = readValue(args, index, argument);
      index += 1;
    } else if (argument === "--concurrency") {
      concurrency = positiveInteger(readValue(args, index, argument), argument);
      index += 1;
    } else if (argument === "--limit") {
      limit = positiveInteger(readValue(args, index, argument), argument);
      index += 1;
    } else {
      throw new VehicleListThumbnailBackfillCliError(
        `unknown option: ${argument}`,
      );
    }
  }

  if (action === "apply" && confirmation !== APPLY_CONFIRMATION) {
    throw new VehicleListThumbnailBackfillCliError(
      `--apply requires --confirm ${APPLY_CONFIRMATION}`,
    );
  }
  if (action === "dry-run" && confirmation !== null) {
    throw new VehicleListThumbnailBackfillCliError(
      "--confirm is only valid with --apply",
    );
  }
  return { apply: action === "apply", concurrency, limit };
}

async function run(options: VehicleListThumbnailBackfillCliOptions): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const images = await prisma.vehicleImage.findMany({
      where: {
        deletedAt: null,
        AND: [
          {
            OR: [
              { listThumbnailUrl: null },
              { listThumbnailStoragePath: null },
            ],
          },
          {
            OR: [
              { type: { in: ["MAIN", "COVER"] } },
              { representativeOf: { isNot: null } },
            ],
          },
        ],
      },
      select: {
        id: true,
        storageUrl: true,
        adminStoragePath: true,
      },
      orderBy: { id: "asc" },
      ...(options.limit === null ? {} : { take: options.limit }),
    });

    const supabase = options.apply ? createStorageClient(process.env) : null;
    const stats = await backfillVehicleListThumbnails({
      apply: options.apply,
      images,
      concurrency: options.concurrency,
      storage: {
        download: async (storagePath) => downloadObject(requiredClient(supabase), storagePath),
        upload: async (storagePath, bytes) => uploadObject(requiredClient(supabase), storagePath, bytes),
      },
      cleanup: {
        reserve: (storagePath) => reserveVehicleImageStorage(prisma, storagePath),
        rollback: (reservation) =>
          markVehicleImageStorageReservationReady(prisma, reservation),
      },
      commit: async (input) => prisma.$transaction(async (tx) => {
        const result = await tx.vehicleImage.updateMany({
          where: buildVehicleListThumbnailBackfillCasWhere(input),
          data: {
            listThumbnailUrl: input.listThumbnailUrl,
            listThumbnailStoragePath: input.listThumbnailStoragePath,
          },
        });
        if (result.count === 1) {
          await releaseVehicleImageStorageReservation(tx, input.reservation);
        } else {
          await markVehicleImageStorageReservationReady(tx, input.reservation);
        }
        return result.count === 1;
      }),
    });

    console.log(JSON.stringify({
      mode: options.apply ? "apply" : "dry-run",
      scanned: images.length,
      ...stats,
    }, null, 2));
    if (!options.apply) {
      console.log(`실제 반영: --apply --confirm ${APPLY_CONFIRMATION}`);
    }
    if (stats.failed > 0) {
      throw new VehicleListThumbnailBackfillCliError(
        `${stats.failed} list thumbnail backfill jobs failed`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function createStorageClient(
  environment: Readonly<Record<string, string | undefined>>,
): SupabaseClient {
  const url = environment["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey = environment["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    throw new VehicleListThumbnailBackfillCliError(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function requiredClient(client: SupabaseClient | null): SupabaseClient {
  if (client === null) {
    throw new VehicleListThumbnailBackfillCliError(
      "storage access is unavailable in dry-run mode",
    );
  }
  return client;
}

async function downloadObject(
  client: SupabaseClient,
  storagePath: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const result = await client.storage.from(VEHICLE_IMAGE_BUCKET).download(storagePath);
  if (result.error || result.data === null) {
    throw new VehicleListThumbnailBackfillCliError(
      `storage download failed: ${result.error?.message ?? "missing object"}`,
    );
  }
  return Uint8Array.from(new Uint8Array(await result.data.arrayBuffer()));
}

async function uploadObject(
  client: SupabaseClient,
  storagePath: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const bucket = client.storage.from(VEHICLE_IMAGE_BUCKET);
  const result = await bucket.upload(storagePath, bytes, {
    contentType: VEHICLE_LIST_THUMBNAIL_CONTENT_TYPE,
    cacheControl: "31536000, immutable",
    upsert: false,
  });
  if (
    result.error
    && !/already exists|duplicate|409|resource exists/i.test(result.error.message ?? "")
  ) {
    throw new VehicleListThumbnailBackfillCliError(
      `storage upload failed: ${result.error.message}`,
    );
  }
  return bucket.getPublicUrl(storagePath).data.publicUrl;
}

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new VehicleListThumbnailBackfillCliError(
      `${option} requires a value`,
    );
  }
  return value;
}

function positiveInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new VehicleListThumbnailBackfillCliError(
      `${option} requires a positive integer`,
    );
  }
  return parsed;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local", quiet: true });
  loadEnv({ path: ".env", quiet: true });
  const options = parseVehicleListThumbnailBackfillArgs(process.argv.slice(2));
  await run(options);
}

if (isMainModule()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "unknown backfill error");
    process.exitCode = 1;
  });
}
