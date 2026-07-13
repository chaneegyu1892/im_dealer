import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ recover: vi.fn(), process: vi.fn(), readback: vi.fn() }));

vi.mock("../src/lib/vehicle-images/storage-cleanup", () => ({
  recoverExpiredReservations: mocks.recover,
  processStorageCleanupOnce: mocks.process,
  readStorageCleanupState: mocks.readback,
}));

import { parseStorageCleanupArgs, runStorageCleanupCli } from "./retry-vehicle-image-storage-cleanup";

describe("vehicle image storage cleanup CLI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recover.mockResolvedValue({ eligible: 2, recovered: 0 });
    mocks.process.mockResolvedValue({ kind: "idle" });
    mocks.readback.mockResolvedValue([{ storagePath: "admin/v/i.webp", status: "READY" }]);
  });

  it("defaults to non-mutating dry-run and explicit readback", () => {
    expect(parseStorageCleanupArgs([])).toEqual({ mode: "dry-run", recoverReservations: false, limit: 100 });
  });

  it("rejects conflicting actions and invalid limits", () => {
    expect(() => parseStorageCleanupArgs(["--apply", "--dry-run"])).toThrow("CONFLICTING_ACTION");
    expect(() => parseStorageCleanupArgs(["--limit", "0"])).toThrow("INVALID_LIMIT");
  });

  it("dry-run reports recovery candidates without claiming deletion jobs", async () => {
    const report = await runStorageCleanupCli(["--recover-reservations"]);
    expect(report).toEqual(expect.objectContaining({ mode: "dry-run", recovery: { eligible: 2, recovered: 0 } }));
    expect(mocks.recover).toHaveBeenCalledWith({ apply: false });
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.readback).toHaveBeenCalledOnce();
  });

  it("apply recovers reservations then processes jobs until idle", async () => {
    mocks.recover.mockResolvedValue({ eligible: 2, recovered: 2 });
    mocks.process
      .mockResolvedValueOnce({ kind: "deleted", storagePath: "admin/v/a.webp" })
      .mockResolvedValueOnce({ kind: "deferred", storagePath: "admin/v/b.webp", reason: "delete_failed" })
      .mockResolvedValueOnce({ kind: "idle" });
    const report = await runStorageCleanupCli(["--apply", "--recover-reservations", "--limit", "5"]);
    expect(report).toEqual(expect.objectContaining({ mode: "apply", processed: 2, deleted: 1, deferred: 1 }));
    expect(mocks.recover).toHaveBeenCalledWith({ apply: true });
    expect(mocks.readback).toHaveBeenCalledOnce();
  });
});
