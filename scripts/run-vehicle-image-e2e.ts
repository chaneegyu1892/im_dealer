import type { ChildProcess } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import type { Server } from "node:http";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  cleanupVehicleImageE2EHarness,
  prepareAndDeployVehicleImageE2EHarness,
  runAsyncCommand,
  startApp,
  type VehicleImageE2EHarness,
} from "./lib/vehicle-image-e2e-harness";
import { cleanupVehicleImageE2EResources, waitForApp } from "./lib/vehicle-image-e2e-lifecycle";
import { startStorageServer } from "./lib/vehicle-image-e2e-storage";

const ROOT = resolve(import.meta.dirname, "..");
const SpecSchema = z.enum([
  "e2e/admin-vehicle-images-desktop.spec.ts",
  "e2e/admin-vehicle-images-mobile.spec.ts",
  "e2e/admin-vehicle-images-failure.spec.ts",
]);

class VehicleImageE2ECommandError extends Error {
  readonly name = "VehicleImageE2ECommandError";
  constructor(readonly command: string, readonly status: number) {
    super(`${command} exited with status ${status}`);
  }
}

function parseSpec(args: readonly string[]): z.infer<typeof SpecSchema> {
  if (args.length !== 2 || args[0] !== "--spec") {
    throw new VehicleImageE2ECommandError("usage: --spec <approved vehicle image spec>", 2);
  }
  return SpecSchema.parse(args[1]);
}

async function requireSuccess(command: string, args: readonly string[], harness: VehicleImageE2EHarness): Promise<void> {
  const status = await runAsyncCommand(command, args, { cwd: ROOT, environment: harness.environment });
  if (status !== 0) throw new VehicleImageE2ECommandError(`${command} ${args.join(" ")}`, status);
}

function findTrace(directory: string): string | null {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findTrace(path);
      if (nested) return nested;
    } else if (entry.name === "trace.zip") return path;
  }
  return null;
}

function preserveTrace(spec: z.infer<typeof SpecSchema>): void {
  const trace = findTrace(join(ROOT, "test-results"));
  if (!trace) throw new VehicleImageE2ECommandError("Playwright trace evidence is missing", 1);
  const label = spec.match(/admin-vehicle-images-(desktop|mobile|failure)\.spec\.ts$/)?.[1];
  if (!label) throw new VehicleImageE2ECommandError("approved spec label is missing", 2);
  const evidence = join(ROOT, ".omo/evidence/carpan2-admin-image-management");
  mkdirSync(evidence, { recursive: true });
  copyFileSync(trace, join(evidence, `task-9-${label}-trace.zip`));
}

async function settle(step: () => void | Promise<void>): Promise<unknown | null> {
  return Promise.resolve().then(step).then(() => null, (error: unknown) => error);
}

async function main(): Promise<void> {
  const spec = parseSpec(process.argv.slice(2));
  let harness: VehicleImageE2EHarness | null = null;
  let storageServer: Server | null = null;
  let app: ChildProcess | null = null;
  const executionError = await settle(async () => {
    harness = await prepareAndDeployVehicleImageE2EHarness(ROOT);
    await requireSuccess(process.execPath, ["--import", "tsx", join(ROOT, "scripts/seed-vehicle-image-e2e.ts")], harness);
    harness.leaseHeartbeat?.assertHealthy();
    storageServer = startStorageServer(harness);
    await requireSuccess("npm", ["run", "build"], harness);
    harness.leaseHeartbeat?.assertHealthy();
    app = startApp(ROOT, harness);
    await waitForApp(harness);
    await requireSuccess(join(ROOT, "node_modules/.bin/playwright"), [
      "test", spec, "--project=chromium", "--workers=1",
    ], harness);
    harness.leaseHeartbeat?.assertHealthy();
    preserveTrace(spec);
  });
  const cleanupError = await settle(() => cleanupVehicleImageE2EResources(
    app,
    storageServer,
    () => { if (harness) cleanupVehicleImageE2EHarness(ROOT, harness); },
  ));
  const errors = [executionError, cleanupError].filter((error) => error !== null);
  if (errors.length > 1) throw new AggregateError(errors, "vehicle image E2E execution and cleanup failed");
  if (errors.length === 1) throw errors[0];
  process.stdout.write(`PASS vehicle-image-e2e spec=${spec} cleanup=verified\n`);
}

main().catch((error: unknown) => { // no-excuse-ok: catch -- CLI boundary reports one sanitized failure.
  process.stderr.write(`${error instanceof Error ? error.message : "unknown vehicle image E2E failure"}\n`);
  process.exitCode = 1;
});
