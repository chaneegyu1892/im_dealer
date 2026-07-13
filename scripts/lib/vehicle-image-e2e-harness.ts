import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HOMEBREW_PG16_BIN, prepareLocalPostgres, runHarnessCommand, startLocalPostgres,
  stopLocalPostgres, type LocalPostgresRuntime } from "./carpan2-cover-harness";
import { databaseEndpointFingerprints, databaseIdentity, databaseIdentityFingerprint,
  type DatabaseEndpointFingerprints } from "./database-target-guard";
import { assertDefaultNextArtifactSafe, cleanupStaleVehicleImageE2EDistDirs,
  cleanupStaleVehicleImageE2EWorkDirs, createVehicleImageE2EDistDir, initializeVehicleImageE2EArtifacts,
  reconcileVehicleImageE2ETsconfig, removeVehicleImageE2ELease,
  startVehicleImageE2ELeaseHeartbeat, writeVehicleImageE2EOwner,
  type VehicleImageE2EHeartbeat } from "./vehicle-image-e2e-artifacts";

export type VehicleImageE2EHarness = {
  readonly environment: NodeJS.ProcessEnv; readonly work: string; readonly storageRoot: string;
  readonly distDir: string; readonly tsconfigPath: string; readonly tsconfigBaseline: string;
  readonly appPort: number; readonly database: LocalPostgresRuntime | null;
  readonly leaseHeartbeat?: VehicleImageE2EHeartbeat;
};

export class VehicleImageE2EHarnessError extends Error { readonly name = "VehicleImageE2EHarnessError"; }

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close();
        reject(new VehicleImageE2EHarnessError("loopback port allocation failed"));
        return;
      }
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

type E2EDatabaseConfiguration = {
  readonly runtimeUrl: string; readonly directUrl: string; readonly expectedFingerprint: string;
};

type ProductionDatabaseFingerprints = { readonly aggregate: string; readonly endpoints: DatabaseEndpointFingerprints };

type SchemaDeployer = (root: string, harness: VehicleImageE2EHarness) => void;

function configuredFingerprint(environment: NodeJS.ProcessEnv, name: string): string {
  const configured = environment[name]?.trim().toLowerCase();
  if (!configured || !/^[a-f0-9]{64}$/.test(configured)) {
    throw new VehicleImageE2EHarnessError(`${name} is required`);
  }
  return configured;
}

function productionFingerprints(environment: NodeJS.ProcessEnv): ProductionDatabaseFingerprints {
  return {
    aggregate: configuredFingerprint(environment, "PRODUCTION_DATABASE_FINGERPRINT"),
    endpoints: {
      runtime: configuredFingerprint(environment, "PRODUCTION_DATABASE_RUNTIME_FINGERPRINT"),
      direct: configuredFingerprint(environment, "PRODUCTION_DATABASE_DIRECT_FINGERPRINT"),
    },
  };
}

function externalDatabaseConfiguration(environment: NodeJS.ProcessEnv): E2EDatabaseConfiguration | null {
  const runtimeUrl = environment.CARPAN2_E2E_DATABASE_URL?.trim();
  const directUrl = environment.CARPAN2_E2E_DIRECT_URL?.trim();
  const expected = environment.CARPAN2_E2E_EXPECTED_FINGERPRINT?.trim();
  if (!runtimeUrl && !directUrl && !expected) return null;
  if (!runtimeUrl || !directUrl || !expected) {
    throw new VehicleImageE2EHarnessError("external E2E database requires runtime URL, direct URL, and expected fingerprint");
  }
  return { runtimeUrl, directUrl, expectedFingerprint: configuredFingerprint(environment, "CARPAN2_E2E_EXPECTED_FINGERPRINT") };
}

function assertIsolatedDatabase(
  configuration: E2EDatabaseConfiguration,
  production: ProductionDatabaseFingerprints,
): string {
  const identity = databaseIdentity(configuration);
  if (!LOOPBACK_HOSTS.has(identity.runtime.host) || !LOOPBACK_HOSTS.has(identity.direct.host)) {
    throw new VehicleImageE2EHarnessError("both E2E database identities must be loopback");
  }
  if (JSON.stringify(identity.runtime) !== JSON.stringify(identity.direct)) {
    throw new VehicleImageE2EHarnessError("E2E runtime and direct database identities must match");
  }
  const actual = databaseIdentityFingerprint(configuration);
  const actualEndpoints = databaseEndpointFingerprints(configuration);
  if (actual !== configuration.expectedFingerprint) {
    throw new VehicleImageE2EHarnessError("E2E database fingerprint mismatch");
  }
  if (actual === production.aggregate) {
    throw new VehicleImageE2EHarnessError("E2E database matches production fingerprint");
  }
  if (actualEndpoints.runtime === production.endpoints.runtime
    || actualEndpoints.runtime === production.endpoints.direct) {
    throw new VehicleImageE2EHarnessError("E2E runtime database matches production endpoint fingerprint");
  }
  if (actualEndpoints.direct === production.endpoints.direct
    || actualEndpoints.direct === production.endpoints.runtime) {
    throw new VehicleImageE2EHarnessError("E2E direct database matches production endpoint fingerprint");
  }
  return actual;
}

export async function prepareVehicleImageE2EHarness(root: string,
  sourceEnvironment: NodeJS.ProcessEnv = process.env): Promise<VehicleImageE2EHarness> {
  const production = productionFingerprints(sourceEnvironment);
  const external = externalDatabaseConfiguration(sourceEnvironment);
  if (external) assertIsolatedDatabase(external, production);
  cleanupStaleVehicleImageE2EDistDirs(root);
  cleanupStaleVehicleImageE2EWorkDirs(tmpdir());
  reconcileVehicleImageE2ETsconfig(root);
  assertDefaultNextArtifactSafe(root);
  const dist = createVehicleImageE2EDistDir(root);
  let tsconfigBaseline = "";
  let database: LocalPostgresRuntime | null = null;
  let work: string | null = null;
  let leaseHeartbeat: VehicleImageE2EHeartbeat | null = null;
  try {
    tsconfigBaseline = initializeVehicleImageE2EArtifacts(root, dist);
    leaseHeartbeat = startVehicleImageE2ELeaseHeartbeat(dist.path);
    database = external ? null : await prepareLocalPostgres();
    if (database) startLocalPostgres(root, database);
    const runtimeUrl = external?.runtimeUrl ?? database?.url;
    const directUrl = external?.directUrl ?? database?.url;
    if (!runtimeUrl || !directUrl) throw new VehicleImageE2EHarnessError("isolated database URLs are missing");
    const localConfiguration = external ?? {
      runtimeUrl,
      directUrl,
      expectedFingerprint: databaseIdentityFingerprint({ runtimeUrl, directUrl }),
    };
    const actual = assertIsolatedDatabase(localConfiguration, production);
    work = mkdtempSync(join(tmpdir(), "vehicle-image-e2e-"));
    writeVehicleImageE2EOwner(work);
    const storageRoot = join(work, "storage");
    const [storagePort, appPort] = await Promise.all([freePort(), freePort()]);
    const environment: NodeJS.ProcessEnv = {
      ...sourceEnvironment,
      DATABASE_URL: runtimeUrl,
      DIRECT_URL: directUrl,
      CARPAN2_E2E_TARGET: "test",
      CARPAN2_E2E_APPLY: "1",
      CARPAN2_E2E_EXPECTED_FINGERPRINT: actual,
      PRODUCTION_DATABASE_FINGERPRINT: production.aggregate,
      PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: production.endpoints.runtime,
      PRODUCTION_DATABASE_DIRECT_FINGERPRINT: production.endpoints.direct,
      VEHICLE_IMAGE_STORAGE_DRIVER: "filesystem-e2e",
      VEHICLE_IMAGE_STORAGE_ROOT: storageRoot,
      VEHICLE_IMAGE_STORAGE_BASE_URL: `http://127.0.0.1:${storagePort}/storage`,
      E2E_ADMIN_EMAIL: "vehicle-image-admin@e2e.invalid",
      E2E_ADMIN_PASSWORD: "vehicle-image-e2e-password",
      E2E_ADMIN_SESSION_TOKEN: `vehicle-image-e2e-session-${process.pid}`,
      ADMIN_ACCESS_TOKEN: "vehicle-image-e2e-access",
      E2E_BASE_URL: `http://127.0.0.1:${appPort}`,
      VEHICLE_IMAGE_E2E_TRACE: "1",
      VEHICLE_IMAGE_E2E_ALLOW_LOCAL_IP: "guarded",
      VEHICLE_IMAGE_E2E_DIST_DIR: dist.name,
      VEHICLE_IMAGE_E2E_TSCONFIG_PATH: dist.tsconfigName,
      VEHICLE_IMAGE_E2E_PREFIX: `vi-e2e-${process.pid}-${Date.now()}`,
      NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${appPort}`,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${storagePort}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key-0000000000000000",
      NEXT_PUBLIC_CHANNEL_TALK_PLUGIN_KEY: "",
      RECOMMEND_ENGINE_VERSION: "overlap-v2",
      IP_HASH_SALT: "vehicle-image-e2e-ip-hash-salt",
      PII_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      CRON_SECRET: "vehicle-image-e2e-cron-secret-000000000000",
      PORT: String(appPort),
    };
    return {
      environment, work, storageRoot, distDir: dist.path, tsconfigPath: dist.tsconfigPath,
      tsconfigBaseline, appPort, database, leaseHeartbeat,
    };
  } catch (error: unknown) { // no-excuse-ok: catch -- startup boundary guarantees owned DB/temp cleanup before rethrow.
    const cleanupErrors: Error[] = [];
    try { leaseHeartbeat?.stop(); } catch (cleanupError: unknown) { cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError))); }
    try { if (database) stopLocalPostgres(root, database); } catch (cleanupError: unknown) { cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError))); }
    try { if (work) rmSync(work, { recursive: true, force: true }); } catch (cleanupError: unknown) { cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError))); }
    try { rmSync(dist.path, { recursive: true, force: true }); } catch (cleanupError: unknown) { cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError))); }
    try { rmSync(dist.tsconfigPath, { force: true }); } catch (cleanupError: unknown) { cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError))); }
    try { removeVehicleImageE2ELease(dist.path); } catch (cleanupError: unknown) { cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError))); }
    try { reconcileVehicleImageE2ETsconfig(root); } catch (cleanupError: unknown) { cleanupErrors.push(cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError))); }
    if (cleanupErrors.length > 0) throw new AggregateError([normalizeError(error), ...cleanupErrors], "E2E preparation and cleanup failed");
    throw error;
  }
}

export function deployVehicleImageE2ESchema(root: string, harness: VehicleImageE2EHarness): void {
  const sqlPath = join(harness.work, "current-schema.sql");
  const prisma = join(root, "node_modules/.bin/prisma");
  const sql = runHarnessCommand(root, prisma, ["migrate", "diff", "--from-empty", "--to-schema-datamodel", join(root, "prisma/schema.prisma"), "--script"], harness.environment);
  writeFileSync(sqlPath, `${sql}\n`, "utf8");
  const psql = harness.database ? join(HOMEBREW_PG16_BIN, "psql") : "psql";
  runHarnessCommand(root, psql, ["--dbname", harness.environment.DATABASE_URL ?? "", "--set", "ON_ERROR_STOP=1", "--file", sqlPath], harness.environment);
}

export async function prepareAndDeployVehicleImageE2EHarness(root: string,
  sourceEnvironment: NodeJS.ProcessEnv = process.env,
  deploy: SchemaDeployer = deployVehicleImageE2ESchema): Promise<VehicleImageE2EHarness> {
  const harness = await prepareVehicleImageE2EHarness(root, sourceEnvironment);
  try {
    deploy(root, harness);
    return harness;
  } catch (error: unknown) { // no-excuse-ok: catch -- deploy boundary cleans the prepared isolated runtime before rethrow.
    cleanupVehicleImageE2EHarness(root, harness);
    throw error;
  }
}

export function startApp(root: string, harness: VehicleImageE2EHarness): ChildProcess {
  return spawn(join(root, "node_modules/.bin/next"), ["start", "-H", "127.0.0.1", "-p", String(harness.appPort)], {
    cwd: root,
    env: harness.environment,
    stdio: "inherit",
  });
}

export async function runAsyncCommand(command: string, args: readonly string[], options: {
  readonly cwd: string; readonly environment: NodeJS.ProcessEnv;
}): Promise<number> {
  return new Promise((resolveStatus, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.environment, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolveStatus(code ?? 1));
  });
}

type HarnessCleanupDependencies = {
  readonly stopDatabase?: (root: string, database: LocalPostgresRuntime) => void;
  readonly removeDirectory?: (path: string) => void; readonly assertDefaultArtifact?: (root: string) => "absent" | "safe";
};

export function cleanupVehicleImageE2EHarness(root: string, harness: VehicleImageE2EHarness,
  dependencies: HarnessCleanupDependencies = {}): void {
  const errors: Error[] = [];
  const stopDatabase = dependencies.stopDatabase ?? stopLocalPostgres;
  const removeDirectory = dependencies.removeDirectory ?? ((path) => rmSync(path, { recursive: true, force: true }));
  try { harness.leaseHeartbeat?.stop(); } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  try { if (harness.database) stopDatabase(root, harness.database); } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  try { removeDirectory(harness.work); } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  try { removeDirectory(harness.distDir); } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  try { rmSync(harness.tsconfigPath, { force: true }); } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  try { removeVehicleImageE2ELease(harness.distDir); } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  try { reconcileVehicleImageE2ETsconfig(root); } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  if (existsSync(harness.work)) errors.push(new VehicleImageE2EHarnessError("E2E temporary directory remains"));
  if (existsSync(harness.distDir)) errors.push(new VehicleImageE2EHarnessError("E2E Next dist directory remains"));
  if (existsSync(harness.tsconfigPath)) errors.push(new VehicleImageE2EHarnessError("E2E Next tsconfig remains"));
  if (existsSync(`${harness.distDir}.owner.json`)) errors.push(new VehicleImageE2EHarnessError("E2E owner lease remains"));
  try {
    if (readFileSync(join(root, "tsconfig.json"), "utf8") !== harness.tsconfigBaseline) {
      throw new VehicleImageE2EHarnessError("base tsconfig changed during E2E run");
    }
  } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  try { (dependencies.assertDefaultArtifact ?? assertDefaultNextArtifactSafe)(root); } catch (error: unknown) { errors.push(error instanceof Error ? error : new Error(String(error))); }
  if (errors.length > 0) throw new AggregateError(errors, "vehicle image E2E harness cleanup failed");
}
