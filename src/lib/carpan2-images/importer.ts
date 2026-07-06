import { PrismaClient, type Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import type { Carpan2ImageCandidate, Carpan2ImageType, ImageMetadata } from "./types";
import { mirrorImage, type MirrorContext } from "../vehicle-image-mirror";

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
}): Promise<Carpan2ImageImportStats> {
  const stats = createInitialStats();
  const tasks: ImportTask[] = [];
  for (const plan of input.plans) {
    if (!plan.dbVehicle) {
      stats.vehiclesMissing += 1;
      continue;
    }
    stats.vehiclesMatched += 1;
    for (const candidate of plan.candidates) {
      tasks.push({ dbVehicle: plan.dbVehicle, candidate });
    }
  }
  await runWithConcurrency({
    items: tasks,
    concurrency: input.concurrency ?? DEFAULT_IMPORT_CONCURRENCY,
    worker: (task) =>
      applyImageCandidate({
        prisma: input.prisma,
        ctx: input.ctx,
        task,
        stats,
      }),
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
  readonly prisma: PrismaClient;
  readonly ctx: MirrorContext;
  readonly task: ImportTask;
  readonly stats: Carpan2ImageImportStats;
}): Promise<void> {
  input.stats.candidates += 1;
  try {
    const existing = await input.prisma.vehicleImage.findUnique({
      where: {
        vehicleId_sourceKey: {
          vehicleId: input.task.dbVehicle.id,
          sourceKey: input.task.candidate.sourceKey,
        },
      },
      select: { sourceUrl: true, storageUrl: true },
    });
    if (existing?.storageUrl && existing.sourceUrl === input.task.candidate.sourceUrl) {
      input.stats.skippedExisting += 1;
      return;
    }
    const mirrored = await mirrorImage(input.task.candidate.sourceUrl, input.ctx);
    if (mirrored.uploaded) input.stats.uploaded += 1;
    else input.stats.mirroredCachedOrExisting += 1;
    await upsertVehicleImage({
      prisma: input.prisma,
      vehicleId: input.task.dbVehicle.id,
      candidate: input.task.candidate,
      storageUrl: mirrored.url,
    });
    input.stats.upserted += 1;
    if (input.stats.candidates % 100 === 0) {
      console.log(`[APPLY] images ${input.stats.candidates}, upserted ${input.stats.upserted}`);
    }
  } catch (error) {
    input.stats.failed += 1;
    if (error instanceof Error) {
      console.warn(
        `[WARN] ${input.task.dbVehicle.brand}/${input.task.dbVehicle.name}: ${error.message} (${input.task.candidate.sourceUrl})`,
      );
    } else {
      throw error;
    }
  }
}

async function upsertVehicleImage(input: {
  readonly prisma: PrismaClient;
  readonly vehicleId: string;
  readonly candidate: Carpan2ImageCandidate;
  readonly storageUrl: string;
}): Promise<void> {
  await input.prisma.vehicleImage.upsert({
    where: {
      vehicleId_sourceKey: {
        vehicleId: input.vehicleId,
        sourceKey: input.candidate.sourceKey,
      },
    },
    create: {
      vehicleId: input.vehicleId,
      type: input.candidate.type,
      title: input.candidate.title,
      storageUrl: input.storageUrl,
      sourceUrl: input.candidate.sourceUrl,
      sourceKey: input.candidate.sourceKey,
      displayOrder: input.candidate.displayOrder,
      metadata: toPrismaJson(input.candidate.metadata),
    },
    update: {
      type: input.candidate.type,
      title: input.candidate.title,
      storageUrl: input.storageUrl,
      sourceUrl: input.candidate.sourceUrl,
      displayOrder: input.candidate.displayOrder,
      isVisible: true,
      metadata: toPrismaJson(input.candidate.metadata),
    },
  });
}

function toPrismaJson(metadata: ImageMetadata): Prisma.InputJsonObject {
  const output: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of Object.entries(metadata)) output[key] = value;
  return output;
}

async function runWithConcurrency<T>(input: {
  readonly items: readonly T[];
  readonly concurrency: number;
  readonly worker: (item: T) => Promise<void>;
}): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(input.concurrency, 1), input.items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < input.items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = input.items[index];
      if (item === undefined) return;
      await input.worker(item);
    }
  });
  await Promise.all(workers);
}
