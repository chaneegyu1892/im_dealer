import type { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import type { Carpan2ImageCandidate, Carpan2ImageType } from "./types";
import {
  createCarpan2ImagePersistence,
  type Carpan2ImagePersistence,
} from "./persistence";
import { mirrorImage, type MirrorContext } from "../vehicle-image-mirror";
import { createCarpan2ListThumbnail } from "./list-thumbnail";
import {
  markVehicleImageStorageReservationReady,
  reserveVehicleImageStorage,
  type VehicleImageStorageReservation,
} from "../vehicle-images/storage-reservation";

const DEFAULT_IMPORT_CONCURRENCY = 8;

export type Carpan2ImageDbVehicle = {
  readonly id: string;
  readonly externalId: string;
  readonly brand: string;
  readonly name: string;
};

export type Carpan2ImageImportPlan = {
  readonly dbVehicle: Carpan2ImageDbVehicle | null;
  readonly candidates: readonly Carpan2ImageCandidate[];
};

export type Carpan2ImageImportStats = {
  vehiclesMatched: number;
  vehiclesMissing: number;
  candidates: number;
  upserted: number;
  uploaded: number;
  mirroredCachedOrExisting: number;
  failed: number;
  skippedExisting: number;
};

export class Carpan2ImageImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Carpan2ImageImportError";
  }
}

export class Carpan2ImageFinalizationError extends Error {
  readonly name = "Carpan2ImageFinalizationError";

  constructor(readonly failures: readonly unknown[]) {
    super("CARPAN2_IMAGE_FINALIZATION_FAILED", { cause: failures[0] });
  }
}

export type Carpan2ListThumbnailCleanup = {
  readonly reserve: (storagePath: string) => Promise<VehicleImageStorageReservation>;
  readonly rollback: (reservation: VehicleImageStorageReservation) => Promise<void>;
};

export async function loadCarpan2ImageDbVehicles(
  prisma: PrismaClient,
): Promise<ReadonlyMap<string, Carpan2ImageDbVehicle>> {
  const vehicles = await prisma.vehicle.findMany({
    where: { externalId: { not: null } },
    select: { id: true, externalId: true, brand: true, name: true },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
  });
  const map = new Map<string, Carpan2ImageDbVehicle>();
  for (const vehicle of vehicles) {
    if (!vehicle.externalId) continue;
    map.set(vehicle.externalId, {
      id: vehicle.id,
      externalId: vehicle.externalId,
      brand: vehicle.brand,
      name: vehicle.name,
    });
  }
  return map;
}

export function formatCarpan2ImagePlanSummary(plans: readonly Carpan2ImageImportPlan[]): string {
  const matched = plans.filter((plan) => plan.dbVehicle).length;
  const missing = plans.length - matched;
  const totalCandidates = plans.reduce((sum, plan) => sum + plan.candidates.length, 0);
  const lines = [
    `이미지 후보 차량: ${plans.length}대`,
    `DB 매칭 차량: ${matched}대`,
    `DB 미매칭 차량: ${missing}대`,
    `이미지 후보: ${totalCandidates}장`,
  ];
  for (const [type, count] of countByType(plans)) lines.push(`- ${type}: ${count}`);
  return lines.join("\n");
}

export function createCarpan2ImageMirrorContext(): MirrorContext {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Carpan2ImageImportError("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return {
    supabase: createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }),
    cache: new Map<string, string>(),
    timeoutMs: 20000,
  };
}

export async function applyCarpan2ImagePlans(input: {
  readonly prisma: PrismaClient;
  readonly ctx: MirrorContext;
  readonly plans: readonly Carpan2ImageImportPlan[];
  readonly concurrency?: number;
  readonly persistence?: Carpan2ImagePersistence;
  readonly mirror?: typeof mirrorImage;
  readonly createListThumbnail?: typeof createCarpan2ListThumbnail;
  readonly listThumbnailCleanup?: Carpan2ListThumbnailCleanup;
}): Promise<Carpan2ImageImportStats> {
  const stats = createInitialStats();
  const tasks: ImportTask[] = [];
  const matchedVehicleIds = new Set<string>();
  const primaryFailureVehicleIds = new Set<string>();
  const persistence = input.persistence ?? createCarpan2ImagePersistence(input.prisma);
  const listThumbnailCleanup = input.listThumbnailCleanup ?? {
    reserve: (storagePath: string) =>
      reserveVehicleImageStorage(input.prisma, storagePath),
    rollback: (reservation: VehicleImageStorageReservation) =>
      markVehicleImageStorageReservationReady(input.prisma, reservation),
  };
  for (const plan of input.plans) {
    if (!plan.dbVehicle) {
      stats.vehiclesMissing += 1;
      continue;
    }
    stats.vehiclesMatched += 1;
    matchedVehicleIds.add(plan.dbVehicle.id);
    for (const candidate of plan.candidates) {
      tasks.push({ dbVehicle: plan.dbVehicle, candidate });
    }
  }
  await runWithConcurrency({
    items: tasks,
    concurrency: input.concurrency ?? DEFAULT_IMPORT_CONCURRENCY,
    worker: (task) =>
      applyImageCandidate({
        ctx: input.ctx,
        mirror: input.mirror ?? mirrorImage,
        createListThumbnail: input.createListThumbnail ?? createCarpan2ListThumbnail,
        listThumbnailCleanup,
        persistence,
        primaryFailureVehicleIds,
        task,
        stats,
      }),
  });
  await runWithConcurrency({
    items: [...matchedVehicleIds].filter((vehicleId) => !primaryFailureVehicleIds.has(vehicleId)),
    concurrency: input.concurrency ?? DEFAULT_IMPORT_CONCURRENCY,
    failureError: (failures) => new Carpan2ImageFinalizationError(failures),
    worker: async (vehicleId) => {
      await persistence.finalizeVehicleRepresentative(vehicleId);
    },
  });
  return stats;
}

export function formatCarpan2ImageImportStats(stats: Carpan2ImageImportStats): string {
  return [
    "\nVehicleImage 적용 완료",
    `매칭 차량: ${stats.vehiclesMatched}`,
    `미매칭 차량: ${stats.vehiclesMissing}`,
    `처리 후보: ${stats.candidates}`,
    `upsert: ${stats.upserted}`,
    `신규 업로드: ${stats.uploaded}`,
    `기존/캐시 사용: ${stats.mirroredCachedOrExisting}`,
    `기존 row 스킵: ${stats.skippedExisting}`,
    `실패: ${stats.failed}`,
  ].join("\n");
}

function countByType(plans: readonly Carpan2ImageImportPlan[]): ReadonlyMap<Carpan2ImageType, number> {
  const counts = new Map<Carpan2ImageType, number>();
  for (const plan of plans) {
    for (const candidate of plan.candidates) {
      counts.set(candidate.type, (counts.get(candidate.type) ?? 0) + 1);
    }
  }
  return counts;
}

function createInitialStats(): Carpan2ImageImportStats {
  return {
    vehiclesMatched: 0,
    vehiclesMissing: 0,
    candidates: 0,
    upserted: 0,
    uploaded: 0,
    mirroredCachedOrExisting: 0,
    failed: 0,
    skippedExisting: 0,
  };
}

type ImportTask = {
  readonly dbVehicle: Carpan2ImageDbVehicle;
  readonly candidate: Carpan2ImageCandidate;
};

async function applyImageCandidate(input: {
  readonly ctx: MirrorContext;
  readonly mirror: typeof mirrorImage;
  readonly createListThumbnail: typeof createCarpan2ListThumbnail;
  readonly listThumbnailCleanup: Carpan2ListThumbnailCleanup;
  readonly persistence: Carpan2ImagePersistence;
  readonly primaryFailureVehicleIds: Set<string>;
  readonly task: ImportTask;
  readonly stats: Carpan2ImageImportStats;
}): Promise<void> {
  input.stats.candidates += 1;
  const cleanupState: {
    reservation: VehicleImageStorageReservation | null;
  } = { reservation: null };
  try {
    const existing = await input.persistence.findExisting(
      input.task.dbVehicle.id,
      input.task.candidate.sourceKey,
    );
    if (existing?.origin === "ADMIN") {
      input.stats.skippedExisting += 1;
      return;
    }
    const needsListThumbnail = input.task.candidate.type === "MAIN"
      || input.task.candidate.type === "COVER";
    if (
      existing?.storageUrl
      && existing.sourceUrl === input.task.candidate.sourceUrl
      && (
        !needsListThumbnail
        || (
          Boolean(existing.listThumbnailUrl?.trim())
          && Boolean(existing.listThumbnailStoragePath?.trim())
        )
      )
    ) {
      input.stats.skippedExisting += 1;
      return;
    }
    const mirrored = await input.mirror(input.task.candidate.sourceUrl, input.ctx);
    if (mirrored.uploaded) input.stats.uploaded += 1;
    else input.stats.mirroredCachedOrExisting += 1;
    const listThumbnail = needsListThumbnail
      ? await input.createListThumbnail({
        ctx: input.ctx,
        storageUrl: mirrored.url,
        reserveBeforeUpload: async (storagePath) => {
          if (cleanupState.reservation !== null) {
            throw new Carpan2ImageImportError("LIST_THUMBNAIL_ALREADY_RESERVED");
          }
          cleanupState.reservation = await input.listThumbnailCleanup.reserve(storagePath);
        },
      })
      : null;
    const reservation = cleanupState.reservation;
    if (needsListThumbnail && reservation === null) {
      throw new Carpan2ImageImportError("LIST_THUMBNAIL_NOT_RESERVED");
    }
    if (listThumbnail !== null && reservation?.storagePath !== listThumbnail.storagePath) {
      throw new Carpan2ImageImportError("LIST_THUMBNAIL_RESERVATION_MISMATCH");
    }
    const result = await input.persistence.applyMirroredCandidate({
      vehicleId: input.task.dbVehicle.id,
      existingImageId: existing?.id ?? null,
      candidate: input.task.candidate,
      storageUrl: mirrored.url,
      listThumbnailUrl: listThumbnail?.url ?? null,
      listThumbnailStoragePath: listThumbnail?.storagePath ?? null,
      listThumbnailReservation: reservation,
    });
    cleanupState.reservation = null;
    if (result === "upserted") input.stats.upserted += 1;
    else input.stats.skippedExisting += 1;
    if (input.stats.candidates % 100 === 0) {
      console.log(`[APPLY] images ${input.stats.candidates}, upserted ${input.stats.upserted}`);
    }
  } catch (error) {
    let failure = error;
    if (cleanupState.reservation !== null) {
      try {
        await input.listThumbnailCleanup.rollback(cleanupState.reservation);
      } catch (rollbackError) {
        failure = new AggregateError(
          [error, rollbackError],
          "LIST_THUMBNAIL_ROLLBACK_FAILED",
        );
      }
    }
    input.stats.failed += 1;
    if (input.task.candidate.type === "MAIN" || input.task.candidate.type === "COVER") {
      input.primaryFailureVehicleIds.add(input.task.dbVehicle.id);
    }
    if (failure instanceof Error) {
      console.warn(
        `[WARN] ${input.task.dbVehicle.brand}/${input.task.dbVehicle.name}: ${failure.message} (${input.task.candidate.sourceUrl})`,
      );
    } else {
      throw failure;
    }
  }
}

async function runWithConcurrency<T>(input: {
  readonly items: readonly T[];
  readonly concurrency: number;
  readonly failureError?: (failures: readonly unknown[]) => Error;
  readonly worker: (item: T) => Promise<void>;
}): Promise<void> {
  let nextIndex = 0;
  const failures: unknown[] = [];
  const workerCount = Math.min(Math.max(input.concurrency, 1), input.items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < input.items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = input.items[index];
      if (item === undefined) return;
      const [result] = await Promise.allSettled([
        Promise.resolve().then(() => input.worker(item)),
      ]);
      if (result?.status === "rejected") failures.push(result.reason);
    }
  });
  await Promise.all(workers);
  if (failures.length === 0) return;
  if (input.failureError) throw input.failureError(failures);
  throw failures[0];
}
