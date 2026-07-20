import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  claimRaw: vi.fn(),
  owner: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  executeRaw: vi.fn(),
  findMany: vi.fn(),
  vehicleFindUnique: vi.fn(),
  imageFindMany: vi.fn(),
  vehicleDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    $executeRawUnsafe: mocks.executeRaw,
    vehicleImage: { findFirst: mocks.owner },
    vehicleImageStorageCleanup: {
      updateMany: mocks.updateMany,
      deleteMany: mocks.deleteMany,
      findMany: mocks.findMany,
    },
  },
}));
vi.mock("@/lib/supabase/storage", () => ({ deleteVehicleImageObject: vi.fn() }));

import { deleteVehicleWithStorageCleanup, processStorageCleanupOnce, recoverExpiredReservations } from "./storage-cleanup";

const NOW = new Date("2026-07-13T00:00:00.000Z");
const job = {
  id: "job-1",
  storagePath: "admin/vehicle-1/image.webp",
  reason: "IMAGE_PURGE",
  status: "PROCESSING",
  reservationToken: null,
  availableAt: NOW,
  leaseToken: "lease-1",
  leaseExpiresAt: new Date(NOW.getTime() + 60_000),
  attempts: 0,
  lastError: null,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("stateful vehicle image storage cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (tx: { $queryRawUnsafe: typeof mocks.claimRaw }) => unknown) => callback({ $queryRawUnsafe: mocks.claimRaw }));
    mocks.claimRaw.mockResolvedValue([job]);
    mocks.owner.mockResolvedValue(null);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    mocks.findMany.mockResolvedValue([]);
  });

  it("claims and deletes one READY object, then removes its matching lease", async () => {
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const result = await processStorageCleanupOnce({ now: NOW, deleteObject });
    expect(result).toEqual({ kind: "deleted", storagePath: job.storagePath });
    expect(deleteObject).toHaveBeenCalledWith(job.storagePath);
    expect(mocks.claimRaw.mock.calls[0]?.[0]).toContain("AT TIME ZONE 'UTC'");
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: job.id, status: "PROCESSING", leaseToken: expect.any(String) } });
  });

  it("never deletes a path with an active ADMIN owner", async () => {
    mocks.owner.mockResolvedValue({ id: "image-live" });
    const deleteObject = vi.fn();
    const result = await processStorageCleanupOnce({ now: NOW, deleteObject });
    expect(result).toEqual({ kind: "deferred", storagePath: job.storagePath, reason: "active_owner" });
    expect(deleteObject).not.toHaveBeenCalled();
    expect(mocks.owner).toHaveBeenCalledWith({
      where: {
        OR: [
          { adminStoragePath: job.storagePath },
          { listThumbnailStoragePath: job.storagePath },
        ],
      },
      select: { id: true },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READY" }) }));
  });

  it("returns a failed lease to READY with attempts and backoff", async () => {
    const result = await processStorageCleanupOnce({
      now: NOW,
      deleteObject: vi.fn().mockRejectedValue(new Error("temporary storage outage")),
    });
    expect(result).toEqual({ kind: "deferred", storagePath: job.storagePath, reason: "delete_failed" });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "READY", attempts: { increment: 1 }, lastError: "temporary storage outage" }),
    }));
  });

  it("marks a job as DEAD once attempts reach the retry ceiling to stop poison retries", async () => {
    // claimCleanup은 attempts=MAX-1 상태의 job을 반환한다고 가정. 한 번 더 실패하면 DEAD로 전환.
    mocks.claimRaw.mockResolvedValue([{ ...job, attempts: 9 }]);
    const result = await processStorageCleanupOnce({
      now: NOW,
      deleteObject: vi.fn().mockRejectedValue(new Error("permanent permission denied")),
    });
    expect(result).toEqual({ kind: "deferred", storagePath: job.storagePath, reason: "delete_failed" });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "DEAD", attempts: { increment: 1 }, lastError: "permanent permission denied" }),
    }));
  });

  it("does not recover a RESERVED upload during the heartbeat grace window", async () => {
    mocks.findMany.mockResolvedValue([{ ...job, status: "RESERVED", availableAt: new Date(NOW.getTime() - 4 * 60_000) }]);
    const result = await recoverExpiredReservations({ apply: true, now: NOW });
    expect(result).toEqual({ eligible: 0, recovered: 0 });
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it("recovers only expired ownerless reservations in apply mode", async () => {
    mocks.findMany.mockResolvedValue([{ ...job, status: "RESERVED", availableAt: new Date(NOW.getTime() - 6 * 60_000) }]);
    mocks.executeRaw.mockResolvedValue(1);
    const result = await recoverExpiredReservations({ apply: true, now: NOW });
    expect(result).toEqual({ eligible: 1, recovered: 1 });
    expect(mocks.executeRaw).toHaveBeenCalledOnce();
    expect(mocks.executeRaw.mock.calls[0]?.[0]).toContain(
      '"listThumbnailStoragePath"',
    );
  });

  it("enqueues originals and list derivatives in the same transaction as vehicle deletion", async () => {
    const raw = vi.fn().mockImplementation(async (query: string) => query.includes("INSERT INTO") ? [{ id: "cleanup" }] : []);
    mocks.vehicleFindUnique.mockResolvedValue({ id: "vehicle-1", name: "테스트 차량" });
    mocks.imageFindMany.mockResolvedValue([
      {
        id: "image-a",
        adminStoragePath: "admin/vehicle-1/a.webp",
        listThumbnailStoragePath: "list-thumbnails/v1/admin/vehicle-1/a.webp",
      },
      {
        id: "image-b",
        adminStoragePath: null,
        listThumbnailStoragePath: "list-thumbnails/v1/carpan/b.webp",
      },
    ]);
    mocks.vehicleDelete.mockResolvedValue({ id: "vehicle-1" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      $queryRawUnsafe: raw,
      vehicle: { findUnique: mocks.vehicleFindUnique, delete: mocks.vehicleDelete },
      vehicleImage: { findMany: mocks.imageFindMany },
    }));
    const result = await deleteVehicleWithStorageCleanup("vehicle-1");
    expect(result).toEqual({ vehicle: { id: "vehicle-1", name: "테스트 차량" }, cleanupJobs: 3 });
    expect(mocks.imageFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { vehicleId: "vehicle-1" },
    }));
    expect(mocks.vehicleDelete).toHaveBeenCalledWith({ where: { id: "vehicle-1" } });
  });
});
