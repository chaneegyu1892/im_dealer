import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "./database-target-guard";
import {
  cleanupVehicleImageE2EHarness,
  prepareAndDeployVehicleImageE2EHarness,
  type VehicleImageE2EHarness,
} from "./vehicle-image-e2e-harness";
import { assertDefaultNextArtifactSafe, createVehicleImageE2EDistDir } from "./vehicle-image-e2e-artifacts";
import { cleanupVehicleImageE2EResources, waitForApp, type ReadinessFetch } from "./vehicle-image-e2e-lifecycle";

const LOOPBACK_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const PRODUCTION_FINGERPRINT = "a".repeat(64);
const PRODUCTION_URLS = {
  runtimeUrl: "postgresql://production-runtime.invalid/production",
  directUrl: "postgresql://production-direct.invalid/production",
} as const;

function externalEnvironment(overrides: Readonly<Record<string, string | undefined>> = {}): NodeJS.ProcessEnv {
  const urls = { runtimeUrl: LOOPBACK_URL, directUrl: LOOPBACK_URL };
  const productionEndpoints = databaseEndpointFingerprints(PRODUCTION_URLS);
  return {
    NODE_ENV: "test",
    CARPAN2_E2E_DATABASE_URL: urls.runtimeUrl,
    CARPAN2_E2E_DIRECT_URL: urls.directUrl,
    CARPAN2_E2E_EXPECTED_FINGERPRINT: databaseIdentityFingerprint(urls),
    PRODUCTION_DATABASE_FINGERPRINT: PRODUCTION_FINGERPRINT,
    PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: productionEndpoints.runtime,
    PRODUCTION_DATABASE_DIRECT_FINGERPRINT: productionEndpoints.direct,
    ...overrides,
  };
}

describe("external vehicle image E2E database preparation", () => {
  it.each([
    ["non-loopback runtime", { CARPAN2_E2E_DATABASE_URL: "postgresql://tester@db.example.invalid/e2e" }],
    ["non-loopback direct", { CARPAN2_E2E_DIRECT_URL: "postgresql://tester@db.example.invalid/e2e" }],
    ["missing direct", { CARPAN2_E2E_DIRECT_URL: undefined }],
    ["missing expected", { CARPAN2_E2E_EXPECTED_FINGERPRINT: undefined }],
    ["mismatched identities", { CARPAN2_E2E_DIRECT_URL: "postgresql://postgres@127.0.0.1:5432/other" }],
    ["wrong expected", { CARPAN2_E2E_EXPECTED_FINGERPRINT: "b".repeat(64) }],
  ])("rejects %s before schema deployment", async (_label, overrides) => {
    const deploy = vi.fn(() => { throw new Error("schema deployment must not start"); });
    await expect(prepareAndDeployVehicleImageE2EHarness(process.cwd(), externalEnvironment(overrides), deploy)).rejects.toThrow();
    expect(deploy).not.toHaveBeenCalled();
  });

  it.each([
    ["runtime", { PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: undefined }],
    ["direct", { PRODUCTION_DATABASE_DIRECT_FINGERPRINT: undefined }],
  ])("rejects a missing production %s fingerprint before schema deployment", async (_label, overrides) => {
    const deploy = vi.fn(() => { throw new Error("schema deployment must not start"); });
    await expect(prepareAndDeployVehicleImageE2EHarness(
      process.cwd(),
      externalEnvironment(overrides),
      deploy,
    )).rejects.toThrow(/PRODUCTION_DATABASE_(RUNTIME|DIRECT)_FINGERPRINT/);
    expect(deploy).not.toHaveBeenCalled();
  });

  it.each([
    ["runtime", "PRODUCTION_DATABASE_RUNTIME_FINGERPRINT"],
    ["direct", "PRODUCTION_DATABASE_DIRECT_FINGERPRINT"],
  ])("rejects an E2E database matching the configured production %s endpoint", async (_label, name) => {
    const environment = externalEnvironment();
    const actualEndpoints = databaseEndpointFingerprints({ runtimeUrl: LOOPBACK_URL, directUrl: LOOPBACK_URL });
    const deploy = vi.fn(() => { throw new Error("schema deployment must not start"); });
    await expect(prepareAndDeployVehicleImageE2EHarness(process.cwd(), {
      ...environment,
      [name]: actualEndpoints.runtime,
    }, deploy)).rejects.toThrow(/matches production.*endpoint/i);
    expect(deploy).not.toHaveBeenCalled();
  });

  it("rejects the production identity before schema deployment", async () => {
    const environment = externalEnvironment();
    const deploy = vi.fn();
    await expect(prepareAndDeployVehicleImageE2EHarness(process.cwd(), {
      ...environment,
      PRODUCTION_DATABASE_FINGERPRINT: environment.CARPAN2_E2E_EXPECTED_FINGERPRINT,
    }, deploy)).rejects.toThrow("matches production fingerprint");
    expect(deploy).not.toHaveBeenCalled();
  });

  it("assigns and removes a unique disposable Next dist directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "vehicle-image-e2e-root-"));
    const work = mkdtempSync(join(tmpdir(), "vehicle-image-e2e-work-"));
    const baseline = `${JSON.stringify({ compilerOptions: {}, include: [] }, null, 2)}\n`;
    writeFileSync(join(root, "tsconfig.json"), baseline, "utf8");
    const dist = createVehicleImageE2EDistDir(root, "unit-run");
    const harness = {
      environment: { NODE_ENV: "test", VEHICLE_IMAGE_E2E_DIST_DIR: dist.name, VEHICLE_IMAGE_E2E_TSCONFIG_PATH: dist.tsconfigName },
      work, storageRoot: join(work, "storage"), distDir: dist.path, tsconfigPath: dist.tsconfigPath,
      tsconfigBaseline: baseline, appPort: 1, database: null,
    } satisfies VehicleImageE2EHarness;
    try {
      expect(harness.environment.VEHICLE_IMAGE_E2E_DIST_DIR).toMatch(/^\.next-e2e-/);
      expect(harness.distDir).toBe(join(root, harness.environment.VEHICLE_IMAGE_E2E_DIST_DIR ?? ""));
      mkdirSync(harness.distDir, { recursive: true });
      writeFileSync(join(harness.distDir, "marker"), "owned", "utf8");
      writeFileSync(harness.tsconfigPath, "{}", "utf8");
      writeFileSync(`${harness.distDir}.owner.json`, "{}", "utf8");
    } finally {
      cleanupVehicleImageE2EHarness(root, harness);
      expect(() => cleanupVehicleImageE2EHarness(root, harness)).not.toThrow();
      expect(() => writeFileSync(`${harness.distDir}.owner.json`, "reclaimed", { flag: "wx" })).not.toThrow();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("vehicle image E2E runtime safety", () => {
  it("rejects an unsafe shared default Next artifact and accepts a safe one", () => {
    const root = mkdtempSync(join(tmpdir(), "vehicle-image-default-artifact-"));
    const artifact = join(root, ".next", "required-server-files.json");
    mkdirSync(join(root, ".next"), { recursive: true });
    try {
      writeFileSync(artifact, JSON.stringify({ config: { images: {
        dangerouslyAllowLocalIP: true,
        remotePatterns: [{ protocol: "http", hostname: "127.0.0.1", pathname: "/storage/**" }],
      } } }), "utf8");
      expect(() => assertDefaultNextArtifactSafe(root)).toThrow("unsafe local-IP");
      writeFileSync(artifact, JSON.stringify({ config: { images: {
        dangerouslyAllowLocalIP: false,
        remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
      } } }), "utf8");
      expect(assertDefaultNextArtifactSafe(root)).toBe("safe");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("aborts each hung readiness request before the overall deadline", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetch: ReadinessFetch = (_url, signal) => new Promise((_resolve, reject) => {
      signals.push(signal);
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    });
    const harness = {
      environment: { NODE_ENV: "test", E2E_BASE_URL: "http://127.0.0.1:1" },
      work: "", storageRoot: "", distDir: "", tsconfigPath: "", tsconfigBaseline: "", appPort: 1, database: null,
    } satisfies VehicleImageE2EHarness;
    try {
      const readiness = waitForApp(harness, {
        fetch, attemptTimeoutMs: 5, overallTimeoutMs: 20, retryDelayMs: 1,
      });
      const rejection = expect(readiness).rejects.toThrow("did not become ready");
      await vi.advanceTimersByTimeAsync(25);
      await rejection;
      expect(signals.length).toBeGreaterThan(1);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs every cleanup step and aggregates injected failures", async () => {
    const stop = vi.fn().mockRejectedValue(new Error("stop failed"));
    const close = vi.fn().mockRejectedValue(new Error("close failed"));
    const cleanup = vi.fn(() => { throw new Error("harness cleanup failed"); });
    await expect(cleanupVehicleImageE2EResources(null, null, cleanup, {
      stopChild: stop, closeServer: close,
    })).rejects.toBeInstanceOf(AggregateError);
    expect(stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("removes temp and dist directories even when PostgreSQL stop rejects", () => {
    const root = mkdtempSync(join(tmpdir(), "vehicle-image-cleanup-root-"));
    const work = mkdtempSync(join(tmpdir(), "vehicle-image-cleanup-work-"));
    const distDir = join(root, ".next-e2e-cleanup-test");
    mkdirSync(distDir, { recursive: true });
    writeFileSync(`${distDir}.owner.json`, "{}", "utf8");
    const removeDirectory = vi.fn((path: string) => rmSync(path, { recursive: true, force: true }));
    const stopHeartbeat = vi.fn(() => { throw new Error("heartbeat stop failed"); });
    const harness = {
      environment: { NODE_ENV: "test" }, work, storageRoot: join(work, "storage"), distDir,
      tsconfigPath: join(root, ".tsconfig-e2e-cleanup-test.json"), tsconfigBaseline: "{}\n", appPort: 1,
      database: { work, data: join(work, "data"), port: 55432, url: LOOPBACK_URL },
      leaseHeartbeat: { assertHealthy: vi.fn(), stop: stopHeartbeat },
    } satisfies VehicleImageE2EHarness;
    try {
      expect(() => cleanupVehicleImageE2EHarness(root, harness, {
        stopDatabase: () => { throw new Error("PostgreSQL stop failed"); },
        removeDirectory,
        assertDefaultArtifact: () => "absent",
      })).toThrow(AggregateError);
      expect(stopHeartbeat).toHaveBeenCalledOnce();
      expect(removeDirectory).toHaveBeenCalledWith(work);
      expect(removeDirectory).toHaveBeenCalledWith(distDir);
      expect(() => writeFileSync(`${distDir}.owner.json`, "reclaimed", { flag: "wx" })).not.toThrow();
    } finally {
      rmSync(work, { recursive: true, force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });
});
