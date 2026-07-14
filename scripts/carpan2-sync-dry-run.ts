import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";
import {
  applyExistingVehiclesToPrisma,
  type ApplyExistingVehiclesStats,
} from "../src/lib/carpan2-sync/prisma-apply";
import { buildCarpan2SyncPlan } from "../src/lib/carpan2-sync/plan";
import { parseCarpan2Vehicles } from "../src/lib/carpan2-sync/parse";
import { formatCarpan2SyncPlan } from "../src/lib/carpan2-sync/report";
import type { Carpan2SyncPlan } from "../src/lib/carpan2-sync/types";
import type { DbTrimSnapshot, DbVehicleSnapshot } from "../src/lib/carpan2-sync/types";

const DEFAULT_CARPAN2_FILE =
  "/Users/jinkyu/.aside/u/0/agents/main/sessions/2026-07-05_Wc3ORy03wLmEPtHn/artifacts/carpan2_vehicles_full_20260705.json";

type CliOptions = {
  readonly filePath: string;
  readonly applyRequested: boolean;
  readonly includeOptionsAndColors: boolean;
};

class CliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgumentError";
  }
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local", quiet: true });
  loadEnv({ path: ".env", quiet: true });

  const options = parseArgs(process.argv.slice(2));
  const rawCrawlData = await readJsonFile(options.filePath);
  const crawlVehicles = parseCarpan2Vehicles(rawCrawlData);
  const prisma = new PrismaClient();

  try {
    const dbVehicles = await loadDbVehicleSnapshots(prisma);
    const plan = buildCarpan2SyncPlan({ dbVehicles, crawlVehicles });
    console.log(formatCarpan2SyncPlan({ sourcePath: options.filePath, plan }));
    if (options.applyRequested) {
      assertSafeToApply(plan);
      const stats = await applyExistingVehiclesToPrisma({
        prisma,
        crawlVehicles,
        includeOptionsAndColors: options.includeOptionsAndColors,
        onVehicleApplied: (progress) => {
          if (
            progress.processedVehicles === progress.totalVehicles ||
            progress.processedVehicles % 10 === 0
          ) {
            console.log(
              `[APPLY] ${progress.processedVehicles}/${progress.totalVehicles} ${progress.vehicleName}`
            );
          }
        },
      });
      console.log(formatApplyStats(stats));
    }
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: readonly string[]): CliOptions {
  let filePath = DEFAULT_CARPAN2_FILE;
  let applyRequested = false;
  let includeOptionsAndColors = false;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--file") {
      const next = argv[index + 1];
      if (!next) throw new CliArgumentError("--file requires a path");
      filePath = next;
      index++;
    } else if (arg === "--apply") {
      applyRequested = true;
    } else if (arg === "--include-options-colors") {
      includeOptionsAndColors = true;
    } else if (arg === "--dry-run") {
      continue;
    } else {
      throw new CliArgumentError(`Unknown argument: ${arg}`);
    }
  }

  return { filePath, applyRequested, includeOptionsAndColors };
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const rawText = await readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(rawText);
  return parsed;
}

async function loadDbVehicleSnapshots(prisma: PrismaClient): Promise<readonly DbVehicleSnapshot[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { externalId: { not: null } },
    select: {
      externalId: true,
      brand: true,
      name: true,
      isVisible: true,
      trims: {
        where: { externalId: { not: null } },
        select: {
          externalId: true,
          name: true,
          price: true,
          isVisible: true,
          _count: {
            select: {
              rateSheets: { where: { isActive: true } },
            },
          },
        },
      },
    },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
  });

  const snapshots: DbVehicleSnapshot[] = [];
  for (const vehicle of vehicles) {
    if (!vehicle.externalId) continue;
    snapshots.push({
      externalId: vehicle.externalId,
      brand: vehicle.brand,
      name: vehicle.name,
      isVisible: vehicle.isVisible,
      trims: toTrimSnapshots(vehicle.trims),
    });
  }
  return snapshots;
}

function toTrimSnapshots(
  trims: readonly {
    readonly externalId: string | null;
    readonly name: string;
    readonly price: number;
    readonly isVisible: boolean;
    readonly _count: { readonly rateSheets: number };
  }[]
): readonly DbTrimSnapshot[] {
  const snapshots: DbTrimSnapshot[] = [];
  for (const trim of trims) {
    if (!trim.externalId) continue;
    snapshots.push({
      externalId: trim.externalId,
      name: trim.name,
      price: trim.price,
      isVisible: trim.isVisible,
      activeRateSheetCount: trim._count.rateSheets,
    });
  }
  return snapshots;
}

function assertSafeToApply(plan: Carpan2SyncPlan): void {
  if (
    plan.ratedSafety.missingRatedVehicles.length > 0 ||
    plan.ratedSafety.missingRatedTrims.length > 0 ||
    plan.ratedSafety.stateChangedRatedTrims.length > 0 ||
    plan.ratedSafety.valueChangedRatedTrims.length > 0
  ) {
    throw new CliArgumentError("회수율 보유 데이터의 누락/판매상태/값 변경 위험이 있어 apply를 중단했습니다.");
  }
}

function formatApplyStats(stats: ApplyExistingVehiclesStats): string {
  return [
    "카판2 기존 차량 apply 완료",
    `업데이트 차량: ${stats.vehiclesUpdated}`,
    `신규 차량 스킵: ${stats.newVehiclesSkipped}`,
    `무효 차량 스킵: ${stats.invalidVehiclesSkipped}`,
    `라인업 upsert: ${stats.lineupsUpserted}`,
    `트림 upsert: ${stats.trimsUpserted}`,
    `무효 트림 스킵: ${stats.invalidTrimsSkipped}`,
    `옵션 upsert: ${stats.optionsUpserted}`,
    `색상 upsert: ${stats.colorsUpserted}`,
  ].join("\n");
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unknown error");
  }
  process.exitCode = 1;
});
