import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  createPrismaBackfillStore,
  readBackfillProjection,
  runCoverBackfill,
} from "../src/lib/vehicle-images/backfill";
import {
  assertDatabaseTarget,
  databaseEndpointFingerprints,
  databaseIdentity,
  databaseIdentityFingerprint,
  type DatabaseEndpointFingerprints,
  type DatabaseIdentity,
  type DatabaseTargetMode,
} from "./lib/database-target-guard";

export type CoverBackfillCliOptions = {
  readonly action: "dry-run" | "apply";
  readonly confirmProduction: string | null;
  readonly output: string | null;
};

type CoverBackfillExecution = {
  readonly guardMode: DatabaseTargetMode;
  readonly target: string;
  readonly identity: DatabaseIdentity;
  readonly actualFingerprint: string;
  readonly actualEndpointFingerprints: DatabaseEndpointFingerprints;
};

type RunCoverBackfillCliRequest = {
  readonly argv: readonly string[];
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly createClient?: () => PrismaClient;
};

export class CoverBackfillCliError extends Error {
  readonly name = "CoverBackfillCliError";

  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export class CoverBackfillReadbackError extends Error {
  readonly name = "CoverBackfillReadbackError";

  constructor(readonly migrationRequired: number, readonly report: unknown | null = null) {
    super(`migration-required projections remain: ${migrationRequired}`);
  }
}

export function assertBackfillReadback(
  readback: { readonly migrationRequired: number },
  report: unknown | null = null,
): void {
  if (readback.migrationRequired > 0) throw new CoverBackfillReadbackError(readback.migrationRequired, report);
}

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new CoverBackfillCliError("MISSING_OPTION_VALUE", `${option} requires a value`);
  }
  return value;
}

export function parseCoverBackfillArgs(args: readonly string[]): CoverBackfillCliOptions {
  let action: CoverBackfillCliOptions["action"] = "dry-run";
  let explicitAction: CoverBackfillCliOptions["action"] | null = null;
  let confirmProduction: string | null = null;
  let output: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run" || argument === "--apply") {
      const requested = argument === "--apply" ? "apply" : "dry-run";
      if (explicitAction !== null && explicitAction !== requested) {
        throw new CoverBackfillCliError("CONFLICTING_ACTION", "choose exactly one of --dry-run or --apply");
      }
      explicitAction = requested;
      action = requested;
    } else if (argument === "--confirm-production") {
      confirmProduction = readValue(args, index, argument);
      index += 1;
    } else if (argument === "--output") {
      output = readValue(args, index, argument);
      index += 1;
    } else {
      throw new CoverBackfillCliError("UNKNOWN_OPTION", `unknown option: ${argument}`);
    }
  }
  if (action === "dry-run" && confirmProduction !== null) {
    throw new CoverBackfillCliError("DRY_RUN_CONFIRMATION", "--confirm-production requires --apply");
  }
  return { action, confirmProduction, output };
}

function requiredUrl(
  environment: Readonly<Record<string, string | undefined>>,
  name: "DATABASE_URL" | "DIRECT_URL",
): string {
  const value = environment[name];
  if (value === undefined || value.trim() === "") {
    throw new CoverBackfillCliError("MISSING_DATABASE_URL", `${name} is required`);
  }
  return value;
}

export function resolveCoverBackfillExecution(
  options: CoverBackfillCliOptions,
  environment: Readonly<Record<string, string | undefined>>,
): CoverBackfillExecution {
  const urls = {
    runtimeUrl: requiredUrl(environment, "DATABASE_URL"),
    directUrl: requiredUrl(environment, "DIRECT_URL"),
  };
  const identity = databaseIdentity(urls);
  const actualFingerprint = databaseIdentityFingerprint(urls);
  const actualEndpointFingerprints = databaseEndpointFingerprints(urls);
  const guardMode = assertDatabaseTarget({
    action: options.action,
    confirmProduction: options.confirmProduction,
    environment: {
      target: environment["CARPAN2_COVER_TARGET"],
      applyFlag: environment["CARPAN2_COVER_APPLY"],
      expectedFingerprint: environment["CARPAN2_COVER_EXPECTED_FINGERPRINT"],
      productionFingerprint: environment["PRODUCTION_DATABASE_FINGERPRINT"],
      productionRuntimeFingerprint: environment["PRODUCTION_DATABASE_RUNTIME_FINGERPRINT"],
      productionDirectFingerprint: environment["PRODUCTION_DATABASE_DIRECT_FINGERPRINT"],
    },
    actualFingerprint,
    actualEndpointFingerprints,
  });
  return {
    guardMode,
    target: environment["CARPAN2_COVER_TARGET"] ?? "unconfigured",
    identity,
    actualFingerprint,
    actualEndpointFingerprints,
  };
}

export async function runCoverBackfillCli(request: RunCoverBackfillCliRequest): Promise<unknown> {
  const options = parseCoverBackfillArgs(request.argv);
  const execution = resolveCoverBackfillExecution(options, request.environment);
  const prisma = request.createClient?.() ?? new PrismaClient();
  try {
    const backfill = await runCoverBackfill({
      store: createPrismaBackfillStore(prisma),
      mode: options.action,
    });
    const readback = options.action === "apply" ? await readBackfillProjection(prisma) : null;
    const report = { ...execution, ...backfill, readback };
    if (options.output !== null) await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    if (readback !== null) assertBackfillReadback(readback, report);
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<void> {
  loadEnv({ path: ".env.local", quiet: true });
  loadEnv({ path: ".env", quiet: true });
  const report = await runCoverBackfillCli({ argv: process.argv.slice(2), environment: process.env });
  console.log(JSON.stringify(report, null, 2));
}

if (isMainModule()) {
  main().catch((error: unknown) => { // no-excuse-ok: catch
    if (error instanceof CoverBackfillReadbackError && error.report !== null) {
      console.log(JSON.stringify(error.report, null, 2));
    }
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : "unknown COVER backfill error" }));
    process.exitCode = 1;
  });
}
