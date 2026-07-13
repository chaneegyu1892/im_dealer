import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  cleanupStaleVehicleImageE2EDistDirs,
  cleanupStaleVehicleImageE2EWorkDirs,
  createVehicleImageE2EDistDir,
  initializeVehicleImageE2EArtifacts,
  refreshVehicleImageE2ELease,
  reconcileVehicleImageE2ETsconfig,
  startVehicleImageE2ELeaseHeartbeat,
  writeVehicleImageE2EOwner,
} from "./vehicle-image-e2e-artifacts";

describe("interrupted vehicle image E2E artifact cleanup", () => {
  it("preserves both active peers after Next clears either dist directory", () => {
    const root = mkdtempSync(join(tmpdir(), "vehicle-image-concurrent-root-"));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ include: [] }), "utf8");
    const first = createVehicleImageE2EDistDir(root, "first-build");
    const second = createVehicleImageE2EDistDir(root, "second-build");
    try {
      initializeVehicleImageE2EArtifacts(root, first, 101);
      initializeVehicleImageE2EArtifacts(root, second, 202);
      expect(existsSync(join(root, `${first.name}.owner.json`))).toBe(true);
      expect(existsSync(join(root, `${second.name}.owner.json`))).toBe(true);

      rmSync(first.path, { recursive: true, force: true });
      mkdirSync(first.path);
      expect(cleanupStaleVehicleImageE2EDistDirs(root, () => true)).toEqual([]);
      expect(existsSync(first.path)).toBe(true);
      expect(existsSync(second.path)).toBe(true);

      rmSync(second.path, { recursive: true, force: true });
      mkdirSync(second.path);
      expect(cleanupStaleVehicleImageE2EDistDirs(root, () => true)).toEqual([]);
      expect(existsSync(first.path)).toBe(true);
      expect(existsSync(second.path)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes dead dist/config/work ownership and restores the base tsconfig include", () => {
    const root = mkdtempSync(join(tmpdir(), "vehicle-image-artifact-root-"));
    const workParent = join(root, "tmp");
    mkdirSync(workParent);
    const baseline = `${JSON.stringify({ compilerOptions: {}, include: [".next/types/**/*.ts"] }, null, 2)}\n`;
    writeFileSync(join(root, "tsconfig.json"), baseline);
    const dead = createVehicleImageE2EDistDir(root, "dead");
    const active = createVehicleImageE2EDistDir(root, "active");
    initializeVehicleImageE2EArtifacts(root, dead, 101, 1_000);
    initializeVehicleImageE2EArtifacts(root, active, 202, 1_000);
    writeFileSync(join(root, "tsconfig.json"), baseline.replace(
      '".next/types/**/*.ts"',
      '".next/types/**/*.ts",\n    ".next-e2e-dead/types/**/*.ts"',
    ));
    const deadDist = dead.path;
    const activeDist = active.path;
    const legacyDist = join(root, ".next-e2e-legacy");
    mkdirSync(legacyDist);
    const deadWork = join(workParent, "vehicle-image-e2e-dead");
    const activeWork = join(workParent, "vehicle-image-e2e-active");
    mkdirSync(deadWork);
    mkdirSync(activeWork);
    writeVehicleImageE2EOwner(deadWork, 101);
    writeVehicleImageE2EOwner(activeWork, 202);
    try {
      expect(cleanupStaleVehicleImageE2EDistDirs(root, (pid) => pid === 202, 1_000)).toEqual([deadDist, legacyDist]);
      expect(cleanupStaleVehicleImageE2EWorkDirs(workParent, (pid) => pid === 202)).toEqual([deadWork]);
      expect(reconcileVehicleImageE2ETsconfig(root)).toBe(1);
      expect(readFileSync(join(root, "tsconfig.json"), "utf8")).toBe(baseline);
      expect(existsSync(join(root, ".tsconfig-e2e-dead.json"))).toBe(false);
      expect(existsSync(activeDist)).toBe(true);
      expect(existsSync(join(root, ".tsconfig-e2e-active.json"))).toBe(true);
      expect(existsSync(activeWork)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refreshes a valid lease and reclaims stale or invalid-token owners even when their PID is live", () => {
    const root = mkdtempSync(join(tmpdir(), "vehicle-image-lease-root-"));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ include: [] }), "utf8");
    const refreshed = createVehicleImageE2EDistDir(root, "refreshed");
    const stale = createVehicleImageE2EDistDir(root, "stale");
    const invalid = createVehicleImageE2EDistDir(root, "invalid");
    try {
      initializeVehicleImageE2EArtifacts(root, refreshed, 101, 1_000);
      initializeVehicleImageE2EArtifacts(root, stale, 202, 1_000);
      initializeVehicleImageE2EArtifacts(root, invalid, 303, 121_001);
      refreshVehicleImageE2ELease(refreshed.path, 121_001);
      const refreshedLease = JSON.parse(readFileSync(refreshed.ownerPath, "utf8")) as { heartbeatAt: number };
      expect(refreshedLease.heartbeatAt).toBe(121_001);
      const invalidLease = JSON.parse(readFileSync(invalid.ownerPath, "utf8")) as Record<string, unknown>;
      writeFileSync(invalid.ownerPath, JSON.stringify({ ...invalidLease, token: "invalid" }), "utf8");
      expect(cleanupStaleVehicleImageE2EDistDirs(root, () => true, 121_001)).toEqual([invalid.path, stale.path]);
      expect(existsSync(refreshed.path)).toBe(true);
      expect(existsSync(refreshed.ownerTempPath)).toBe(false);
      expect(existsSync(stale.ownerPath)).toBe(false);
      expect(existsSync(invalid.ownerPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("heartbeats outside the dist directory and stops without leaving a temporary lease", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const root = mkdtempSync(join(tmpdir(), "vehicle-image-heartbeat-root-"));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ include: [] }), "utf8");
    const artifacts = createVehicleImageE2EDistDir(root, "heartbeat");
    try {
      initializeVehicleImageE2EArtifacts(root, artifacts, 101, 1_000);
      const heartbeat = startVehicleImageE2ELeaseHeartbeat(artifacts.path, 10);
      vi.setSystemTime(2_000);
      await vi.advanceTimersByTimeAsync(10);
      heartbeat.stop();
      const lease = JSON.parse(readFileSync(artifacts.ownerPath, "utf8")) as { heartbeatAt: number };
      expect(lease.heartbeatAt).toBe(2_010);
      expect(existsSync(artifacts.ownerTempPath)).toBe(false);
    } finally {
      vi.useRealTimers();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("surfaces replacement of the lease token instead of adopting another owner", async () => {
    vi.useFakeTimers();
    const root = mkdtempSync(join(tmpdir(), "vehicle-image-token-root-"));
    writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ include: [] }), "utf8");
    const artifacts = createVehicleImageE2EDistDir(root, "token-owner");
    try {
      initializeVehicleImageE2EArtifacts(root, artifacts, 101);
      const heartbeat = startVehicleImageE2ELeaseHeartbeat(artifacts.path, 10);
      const lease = JSON.parse(readFileSync(artifacts.ownerPath, "utf8")) as Record<string, unknown>;
      writeFileSync(artifacts.ownerPath, JSON.stringify({
        ...lease, token: "00000000-0000-4000-8000-000000000000",
      }), "utf8");
      await vi.advanceTimersByTimeAsync(10);
      expect(() => heartbeat.assertHealthy()).toThrow("token changed");
      expect(() => heartbeat.stop()).toThrow("token changed");
    } finally {
      vi.useRealTimers();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
