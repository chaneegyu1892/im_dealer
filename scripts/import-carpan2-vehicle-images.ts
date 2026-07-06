import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";
import { extractCarpan2ImageCandidates } from "../src/lib/carpan2-images/extract";
import {
  applyCarpan2ImagePlans,
  createCarpan2ImageMirrorContext,
  formatCarpan2ImageImportStats,
  formatCarpan2ImagePlanSummary,
  loadCarpan2ImageDbVehicles,
} from "../src/lib/carpan2-images/importer";
import { parseCarpan2ImageVehicles } from "../src/lib/carpan2-images/parse";

const DEFAULT_CARPAN2_FILE =
  "/Users/jinkyu/.aside/u/0/agents/main/sessions/2026-07-05_Wc3ORy03wLmEPtHn/artifacts/carpan2_vehicles_full_20260705.json";

type CliOptions = {
  readonly filePath: string;
  readonly applyRequested: boolean;
  readonly includeOptionImages: boolean;
  readonly vehicleExternalId: string | null;
  readonly limit: number | null;
  readonly concurrency: number;
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
  const rawData = await readJsonFile(options.filePath);
  const crawlVehicles = parseCarpan2ImageVehicles(rawData);
  const prisma = new PrismaClient();

  try {
    const dbVehicles = await loadCarpan2ImageDbVehicles(prisma);
    const plans = crawlVehicles
      .filter((vehicle) => !options.vehicleExternalId || vehicle.modelId === options.vehicleExternalId)
      .map((vehicle) => ({
        crawlVehicle: vehicle,
        dbVehicle: dbVehicles.get(vehicle.modelId) ?? null,
        candidates: extractCarpan2ImageCandidates(vehicle, {
          includeOptionImages: options.includeOptionImages,
        }),
      }))
      .filter((plan) => plan.candidates.length > 0);
    const limitedPlans = options.limit ? plans.slice(0, options.limit) : plans;
    console.log(formatCarpan2ImagePlanSummary(limitedPlans));

    if (!options.applyRequested) {
      console.log("\nDRY-RUN 완료. 실제 저장은 --apply 를 붙여 실행하세요.");
      return;
    }

    const ctx = createCarpan2ImageMirrorContext();
    const stats = await applyCarpan2ImagePlans({
      prisma,
      ctx,
      plans: limitedPlans,
      concurrency: options.concurrency,
    });
    console.log(formatCarpan2ImageImportStats(stats));
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: readonly string[]): CliOptions {
  let filePath = DEFAULT_CARPAN2_FILE;
  let applyRequested = false;
  let includeOptionImages = false;
  let vehicleExternalId: string | null = null;
  let limit: number | null = null;
  let concurrency = 8;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--file") {
      filePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--apply") {
      applyRequested = true;
    } else if (arg === "--dry-run") {
      continue;
    } else if (arg === "--include-options") {
      includeOptionImages = true;
    } else if (arg === "--vehicle") {
      vehicleExternalId = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--limit") {
      limit = parsePositiveInt(readArgValue(argv, index, arg), arg);
      index += 1;
    } else if (arg === "--concurrency") {
      concurrency = parsePositiveInt(readArgValue(argv, index, arg), arg);
      index += 1;
    } else {
      throw new CliArgumentError(`Unknown argument: ${arg}`);
    }
  }

  return { filePath, applyRequested, includeOptionImages, vehicleExternalId, limit, concurrency };
}

function readArgValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new CliArgumentError(`${flag} requires a value`);
  return value;
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliArgumentError(`${flag} requires a positive integer`);
  }
  return parsed;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const rawText = await readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(rawText);
  return parsed;
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unknown error");
  }
  process.exitCode = 1;
});
