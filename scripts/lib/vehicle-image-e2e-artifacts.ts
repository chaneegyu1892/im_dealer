import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const OWNER_FILE = ".vehicle-image-e2e-owner.json";
const LEASE_MAX_AGE_MS = 120_000;
const LEASE_HEARTBEAT_MS = 10_000;
const LEASE_CLOCK_SKEW_MS = 5_000;
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type E2ELease = {
  readonly version: 1;
  readonly runId: string;
  readonly pid: number;
  readonly token: string;
  readonly heartbeatAt: number;
};

export type VehicleImageE2EHeartbeat = {
  readonly assertHealthy: () => void;
  readonly stop: () => void;
};

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function assertDefaultNextArtifactSafe(root: string): "absent" | "safe" {
  const artifact = join(root, ".next", "required-server-files.json");
  if (!existsSync(artifact)) return "absent";
  const parsed: unknown = JSON.parse(readFileSync(artifact, "utf8"));
  const images = objectValue(objectValue(objectValue(parsed)?.config)?.images);
  const patterns = images?.remotePatterns;
  const hasLoopbackPattern = Array.isArray(patterns) && patterns.some((pattern) => {
    const hostname = objectValue(pattern)?.hostname;
    return typeof hostname === "string" && LOOPBACK_HOSTS.has(hostname.toLowerCase());
  });
  if (images?.dangerouslyAllowLocalIP !== false || hasLoopbackPattern) {
    throw new Error("default Next artifact contains unsafe local-IP image configuration");
  }
  return "safe";
}

export function createVehicleImageE2EDistDir(root: string, runId: string = randomUUID()): {
  readonly runId: string;
  readonly name: string;
  readonly path: string;
  readonly tsconfigName: string;
  readonly tsconfigPath: string;
  readonly ownerPath: string;
  readonly ownerTempPath: string;
} {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(runId)) throw new Error("E2E dist run id is invalid");
  const name = `.next-e2e-${runId}`;
  const tsconfigName = `.tsconfig-e2e-${runId}.json`;
  const ownerPath = join(root, `${name}.owner.json`);
  return {
    runId, name, path: join(root, name), tsconfigName, tsconfigPath: join(root, tsconfigName),
    ownerPath, ownerTempPath: `${ownerPath}.tmp`,
  };
}

export function writeVehicleImageE2EOwner(path: string, pid = process.pid): void {
  writeFileSync(join(path, OWNER_FILE), JSON.stringify({ pid }), { encoding: "utf8", flag: "wx" });
}

export function initializeVehicleImageE2EArtifacts(
  root: string,
  artifacts: ReturnType<typeof createVehicleImageE2EDistDir>,
  pid = process.pid,
  now = Date.now(),
): string {
  const baseline = readFileSync(join(root, "tsconfig.json"), "utf8");
  const lease: E2ELease = { version: 1, runId: artifacts.runId, pid, token: randomUUID(), heartbeatAt: now };
  writeFileSync(artifacts.ownerPath, JSON.stringify(lease), { encoding: "utf8", flag: "wx" });
  mkdirSync(artifacts.path, { recursive: false });
  writeFileSync(artifacts.tsconfigPath, baseline, { encoding: "utf8", flag: "wx" });
  return baseline;
}

function distArtifacts(distPath: string): ReturnType<typeof createVehicleImageE2EDistDir> {
  const match = /^\.next-e2e-([A-Za-z0-9][A-Za-z0-9-]*)$/.exec(basename(distPath));
  if (!match) throw new Error("E2E dist path is invalid");
  return createVehicleImageE2EDistDir(dirname(distPath), match[1]);
}

function parseLease(path: string): E2ELease | null {
  if (!existsSync(path)) return null;
  try {
    const value = objectValue(JSON.parse(readFileSync(path, "utf8")));
    if (value?.version !== 1 || typeof value.runId !== "string" || typeof value.pid !== "number"
      || typeof value.token !== "string" || typeof value.heartbeatAt !== "number") return null;
    return value as E2ELease;
  } catch (error: unknown) { // no-excuse-ok: catch -- malformed or concurrently replaced lease is fail-closed.
    if (error instanceof SyntaxError) return null;
    throw error instanceof Error ? error : new Error(String(error));
  }
}

function leaseIsLive(lease: E2ELease | null, runId: string, isAlive: (pid: number) => boolean, now: number): boolean {
  if (!lease || lease.runId !== runId || !Number.isSafeInteger(lease.pid) || lease.pid <= 0
    || !TOKEN_PATTERN.test(lease.token) || !Number.isSafeInteger(lease.heartbeatAt)) return false;
  const age = now - lease.heartbeatAt;
  return age >= -LEASE_CLOCK_SKEW_MS && age <= LEASE_MAX_AGE_MS && isAlive(lease.pid);
}

export function refreshVehicleImageE2ELease(distPath: string, now = Date.now(), expectedToken?: string): void {
  const artifacts = distArtifacts(distPath);
  const lease = parseLease(artifacts.ownerPath);
  if (!lease || lease.runId !== artifacts.runId || !TOKEN_PATTERN.test(lease.token)) {
    throw new Error("E2E owner lease is missing or invalid");
  }
  if (expectedToken && lease.token !== expectedToken) throw new Error("E2E owner lease token changed");
  const next: E2ELease = { ...lease, heartbeatAt: now };
  writeFileSync(artifacts.ownerTempPath, JSON.stringify(next), { encoding: "utf8", flag: "wx" });
  renameSync(artifacts.ownerTempPath, artifacts.ownerPath);
}

export function startVehicleImageE2ELeaseHeartbeat(
  distPath: string,
  intervalMs = LEASE_HEARTBEAT_MS,
): VehicleImageE2EHeartbeat {
  const artifacts = distArtifacts(distPath);
  const expectedToken = parseLease(artifacts.ownerPath)?.token;
  if (!expectedToken || !TOKEN_PATTERN.test(expectedToken)) throw new Error("E2E owner lease is missing or invalid");
  let failure: Error | null = null;
  const timer = setInterval(() => {
    try {
      refreshVehicleImageE2ELease(distPath, Date.now(), expectedToken);
    } catch (error: unknown) { // no-excuse-ok: catch -- timer failure is retained and surfaced at the runner cleanup boundary.
      failure = error instanceof Error ? error : new Error(String(error));
    }
  }, intervalMs);
  timer.unref();
  return {
    assertHealthy: () => { if (failure) throw failure; },
    stop: () => { clearInterval(timer); if (failure) throw failure; },
  };
}

export function removeVehicleImageE2ELease(distPath: string): void {
  const artifacts = distArtifacts(distPath);
  rmSync(artifacts.ownerTempPath, { force: true });
  rmSync(artifacts.ownerPath, { force: true });
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) { // no-excuse-ok: catch -- PID probing distinguishes dead from permission-denied owners.
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export function cleanupStaleVehicleImageE2EDistDirs(
  root: string,
  isAlive: (pid: number) => boolean = processIsAlive,
  now = Date.now(),
): readonly string[] {
  const removed: string[] = [];
  const runIds = new Set<string>();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const match = /^(?:\.next-e2e-|\.tsconfig-e2e-)([A-Za-z0-9][A-Za-z0-9-]*?)(?:\.owner\.json(?:\.tmp)?|\.json)?$/.exec(entry.name);
    if (match) runIds.add(match[1]);
  }
  for (const runId of [...runIds].sort()) {
    const artifacts = createVehicleImageE2EDistDir(root, runId);
    const live = leaseIsLive(parseLease(artifacts.ownerPath), runId, isAlive, now)
      || leaseIsLive(parseLease(artifacts.ownerTempPath), runId, isAlive, now);
    if (live) continue;
    const hadDist = existsSync(artifacts.path);
    rmSync(artifacts.path, { recursive: true, force: true });
    rmSync(artifacts.tsconfigPath, { force: true });
    rmSync(artifacts.ownerTempPath, { force: true });
    rmSync(artifacts.ownerPath, { force: true });
    if (hadDist) removed.push(artifacts.path);
  }
  return removed;
}

export function cleanupStaleVehicleImageE2EWorkDirs(
  parent: string,
  isAlive: (pid: number) => boolean = processIsAlive,
): readonly string[] {
  const removed: string[] = [];
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^vehicle-image-e2e-[A-Za-z0-9-]+$/.test(entry.name)) continue;
    const path = join(parent, entry.name);
    const ownerText = existsSync(join(path, OWNER_FILE)) ? readFileSync(join(path, OWNER_FILE), "utf8") : "";
    const pidText = /"pid"\s*:\s*(\d+)/.exec(ownerText)?.[1];
    const pid = pidText ? Number(pidText) : null;
    if (pid !== null && Number.isSafeInteger(pid) && pid > 0 && isAlive(pid)) continue;
    rmSync(path, { recursive: true, force: true });
    removed.push(path);
  }
  return removed;
}

export function reconcileVehicleImageE2ETsconfig(root: string): number {
  const path = join(root, "tsconfig.json");
  const parsed = objectValue(JSON.parse(readFileSync(path, "utf8")));
  const include = parsed?.include;
  if (!parsed || !Array.isArray(include)) throw new Error("tsconfig include must be an array");
  const next = include.filter((entry) => typeof entry !== "string" || !/^\.next-e2e-[A-Za-z0-9-]+\/(?:dev\/)?types\/\*\*\/\*\.ts$/.test(entry));
  const removed = include.length - next.length;
  if (removed > 0) {
    parsed.include = next;
    writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  }
  return removed;
}
