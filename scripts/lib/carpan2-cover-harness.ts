import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const HOMEBREW_PG16_BIN = "/opt/homebrew/opt/postgresql@16/bin";

const EndpointIdentitySchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
}).strict();

const ReportCountsSchema = z.object({
  vehicles: z.number().int().nonnegative(),
  plannedCreates: z.number().int().nonnegative(),
  plannedVehicleUpdates: z.number().int().nonnegative(),
  missingCandidates: z.number().int().nonnegative(),
  invalidCandidates: z.number().int().nonnegative(),
  blockedLegacyUrls: z.number().int().nonnegative(),
  migrationRequired: z.number().int().nonnegative(),
  writes: z.number().int().nonnegative(),
}).strict();

const ReportSampleSchema = z.object({ id: z.string(), name: z.string() }).strict();

export const CoverBackfillHarnessReportSchema = z.object({
  guardMode: z.enum(["dry-run", "development", "test", "staging", "production"]),
  target: z.string(),
  identity: z.object({ runtime: EndpointIdentitySchema, direct: EndpointIdentitySchema }).strict(),
  actualFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.literal("carpan2-cover-backfill-v1"),
  mode: z.enum(["dry-run", "apply"]),
  counts: ReportCountsSchema,
  changedSamples: z.array(ReportSampleSchema),
  preservedCustom: z.array(z.object({ id: z.string(), name: z.string(), url: z.string() }).strict()),
  readback: z.object({
    checked: z.number().int().nonnegative(),
    migrationRequired: z.number().int().nonnegative(),
    samples: z.array(ReportSampleSchema),
  }).strict().nullable(),
}).strict();

export type CoverBackfillHarnessReport = z.infer<typeof CoverBackfillHarnessReportSchema>;

export type LocalPostgresRuntime = {
  readonly work: string;
  readonly data: string;
  readonly port: number;
  readonly url: string;
};

export type HarnessCommandResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

type CleanupState = {
  readonly beforeStatus: number;
  readonly afterStatus: number;
  readonly readinessStatus: number;
  readonly postmasterAlive: boolean;
};

type FirstApplyReceipt = {
  readonly writes: number;
  readonly invalidCandidates: number;
  readonly blockedLegacyUrls: number;
  readonly migrationRequired: number;
};

export class CoverHarnessError extends Error { readonly name = "CoverHarnessError"; }
export class CoverHarnessCommandError extends Error {
  readonly name = "CoverHarnessCommandError";
  constructor(readonly command: string, readonly result: HarnessCommandResult) {
    super(`${command} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
}

export function probeHarnessCommand(
  root: string,
  command: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): HarnessCommandResult {
  const result = spawnSync(command, args, {
    cwd: root,
    env: environment,
    encoding: "utf8",
    timeout: 90_000,
    maxBuffer: 10_000_000,
  });
  return {
    status: result.error ? 127 : (result.status ?? 1),
    stdout: result.stdout,
    stderr: result.error?.message ?? result.stderr,
  };
}

export function runHarnessCommand(
  root: string,
  command: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const result = probeHarnessCommand(root, command, args, environment);
  if (result.status !== 0) throw new CoverHarnessCommandError(`${command} ${args.join(" ")}`, result);
  return result.stdout.trim();
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close();
        reject(new CoverHarnessError("loopback port allocation failed"));
        return;
      }
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

export async function prepareLocalPostgres(): Promise<LocalPostgresRuntime> {
  if (!existsSync(join(HOMEBREW_PG16_BIN, "postgres"))) {
    throw new CoverHarnessError("unlinked Homebrew PostgreSQL 16 is required");
  }
  const port = await freePort();
  const work = mkdtempSync(join(tmpdir(), "carpan2-cover-backfill-"));
  return {
    work,
    data: join(work, "pgdata"),
    port,
    url: `postgresql://postgres@127.0.0.1:${port}/postgres`,
  };
}

export function startLocalPostgres(root: string, runtime: LocalPostgresRuntime): void {
  runHarnessCommand(root, join(HOMEBREW_PG16_BIN, "initdb"), [
    "-D", runtime.data, "--username", "postgres", "--auth", "trust", "--no-locale", "--encoding", "UTF8",
  ]);
  runHarnessCommand(root, join(HOMEBREW_PG16_BIN, "pg_ctl"), [
    "-D", runtime.data,
    "-l", join(runtime.work, "postgres.log"),
    "-o", `-h 127.0.0.1 -p ${runtime.port}`,
    "-w", "-t", "20", "start",
  ]);
}

export function deployDisposableSchemaFixture(input: {
  readonly root: string;
  readonly prismaBinary: string;
  readonly schemaPath: string;
  readonly runtime: LocalPostgresRuntime;
  readonly environment: NodeJS.ProcessEnv;
}): void {
  const sqlPath = join(input.runtime.work, "current-schema.sql");
  const sql = runHarnessCommand(input.root, input.prismaBinary, ["migrate", "diff", "--from-empty", "--to-schema-datamodel", input.schemaPath, "--script"], input.environment);
  writeFileSync(sqlPath, `${sql}\n`, "utf8");
  runHarnessCommand(input.root, join(HOMEBREW_PG16_BIN, "psql"), ["--dbname", input.runtime.url, "--set", "ON_ERROR_STOP=1", "--file", sqlPath], input.environment);
}

export function assertPostgresCleanupState(state: CleanupState): void {
  if (state.beforeStatus !== 0 && state.beforeStatus !== 3) {
    throw new CoverHarnessError(`unexpected pg_ctl pre-cleanup status: ${state.beforeStatus}`);
  }
  if (state.afterStatus !== 3) {
    throw new CoverHarnessError(`unexpected pg_ctl stopped status: ${state.afterStatus}`);
  }
  if (state.readinessStatus !== 2) {
    throw new CoverHarnessError(`PostgreSQL listener remains or readiness failed: ${state.readinessStatus}`);
  }
  if (state.postmasterAlive) throw new CoverHarnessError("owned PostgreSQL postmaster remains alive");
}

export function assertFirstApplyReceipt(receipt: FirstApplyReceipt): void {
  if (receipt.writes !== 10) {
    throw new CoverHarnessError(`expected exactly 10 first-apply writes, received ${receipt.writes}`);
  }
  if (receipt.invalidCandidates !== 3) {
    throw new CoverHarnessError(`expected exactly 3 invalid candidates, received ${receipt.invalidCandidates}`);
  }
  if (receipt.blockedLegacyUrls !== 2) {
    throw new CoverHarnessError(`expected exactly 2 blocked legacy URLs, received ${receipt.blockedLegacyUrls}`);
  }
  if (receipt.migrationRequired !== 0) {
    throw new CoverHarnessError(`expected zero migration-required projections, received ${receipt.migrationRequired}`);
  }
}

function readPostmasterPid(runtime: LocalPostgresRuntime): number | null {
  const path = join(runtime.data, "postmaster.pid");
  if (!existsSync(path)) return null;
  const pid = Number(readFileSync(path, "utf8").split("\n")[0]);
  if (!Number.isInteger(pid) || pid <= 0) throw new CoverHarnessError("invalid owned PostgreSQL PID marker");
  return pid;
}

function processAlive(pid: number | null): boolean {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") return false;
    throw error;
  }
}

export function stopLocalPostgres(root: string, runtime: LocalPostgresRuntime): void {
  const pid = readPostmasterPid(runtime);
  const pgCtl = join(HOMEBREW_PG16_BIN, "pg_ctl");
  const initialized = existsSync(join(runtime.data, "PG_VERSION"));
  const before = initialized
    ? probeHarnessCommand(root, pgCtl, ["-D", runtime.data, "status"])
    : { status: 3, stdout: "", stderr: "" };
  if (before.status === 0) {
    runHarnessCommand(root, pgCtl, ["-D", runtime.data, "-m", "immediate", "-w", "-t", "20", "stop"]);
  }
  const after = initialized
    ? probeHarnessCommand(root, pgCtl, ["-D", runtime.data, "status"])
    : { status: 3, stdout: "", stderr: "" };
  const readiness = probeHarnessCommand(root, join(HOMEBREW_PG16_BIN, "pg_isready"), [
    "-h", "127.0.0.1", "-p", String(runtime.port), "-U", "postgres",
  ]);
  assertPostgresCleanupState({
    beforeStatus: before.status,
    afterStatus: after.status,
    readinessStatus: readiness.status,
    postmasterAlive: processAlive(pid),
  });
  rmSync(runtime.work, { recursive: true, force: true });
  if (existsSync(runtime.work)) throw new CoverHarnessError(`temporary fixture remains: ${runtime.work}`);
}
