import { pathToFileURL } from "node:url";
import { prisma } from "../src/lib/prisma";
import {
  processStorageCleanupOnce,
  readStorageCleanupState,
  recoverExpiredReservations,
} from "../src/lib/vehicle-images/storage-cleanup";

type CleanupCliMode = "dry-run" | "apply" | "readback";

export type StorageCleanupCliOptions = {
  readonly mode: CleanupCliMode;
  readonly recoverReservations: boolean;
  readonly limit: number;
};

export class StorageCleanupCliError extends Error {
  readonly name = "StorageCleanupCliError";

  constructor(readonly code: "CONFLICTING_ACTION" | "INVALID_LIMIT" | "UNKNOWN_OPTION") {
    super(code);
  }
}

export function parseStorageCleanupArgs(argv: readonly string[]): StorageCleanupCliOptions {
  let mode: CleanupCliMode = "dry-run";
  let explicitMode: CleanupCliMode | null = null;
  let recoverReservations = false;
  let limit = 100;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run" || argument === "--apply" || argument === "--readback") {
      const requested: CleanupCliMode = argument === "--apply"
        ? "apply"
        : argument === "--readback" ? "readback" : "dry-run";
      if (explicitMode !== null && explicitMode !== requested) {
        throw new StorageCleanupCliError("CONFLICTING_ACTION");
      }
      explicitMode = requested;
      mode = requested;
    } else if (argument === "--recover-reservations") {
      recoverReservations = true;
    } else if (argument === "--limit") {
      const raw = argv[index + 1];
      const parsed = raw === undefined ? Number.NaN : Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000) {
        throw new StorageCleanupCliError("INVALID_LIMIT");
      }
      limit = parsed;
      index += 1;
    } else {
      throw new StorageCleanupCliError("UNKNOWN_OPTION");
    }
  }
  return { mode, recoverReservations, limit };
}

export async function runStorageCleanupCli(argv: readonly string[]) {
  const options = parseStorageCleanupArgs(argv);
  const recovery = options.recoverReservations
    ? await recoverExpiredReservations({ apply: options.mode === "apply" })
    : null;
  let processed = 0;
  let deleted = 0;
  let deferred = 0;
  if (options.mode === "apply") {
    while (processed < options.limit) {
      const result = await processStorageCleanupOnce();
      if (result.kind === "idle") break;
      processed += 1;
      if (result.kind === "deleted") deleted += 1;
      if (result.kind === "deferred") deferred += 1;
    }
  }
  const readback = await readStorageCleanupState();
  return { mode: options.mode, recovery, processed, deleted, deferred, readback };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

async function main(): Promise<void> {
  try {
    const report = await runStorageCleanupCli(process.argv.slice(2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (isMainModule()) {
  main().catch((error: unknown) => { // no-excuse-ok: catch
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : "UNKNOWN_CLEANUP_ERROR" }));
    process.exitCode = 1;
  });
}
