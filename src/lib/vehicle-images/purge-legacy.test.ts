import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withLocked: vi.fn(),
  deleteImage: vi.fn(),
  findImage: vi.fn(),
  updateVehicle: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/supabase/storage", () => ({ deleteVehicleImageObject: vi.fn() }));
vi.mock("./transaction", () => ({ withLockedVehicleImages: mocks.withLocked }));

import { purgeVehicleImage } from "./storage-cleanup";

const UPDATED_AT = new Date("2026-07-13T00:00:00.000Z");
const legacyAdmin = {
  id: "image-legacy",
  vehicleId: "vehicle-1",
  type: "MAIN",
  origin: "ADMIN",
  title: "기존 이미지",
  storageUrl: "https://legacy.example/image.webp",
  sourceUrl: null,
  sourceKey: "legacy:url:key",
  adminStoragePath: null,
  displayOrder: 0,
  isVisible: false,
  deletedAt: new Date("2026-07-12T00:00:00.000Z"),
  metadata: null,
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
};

describe("legacy ADMIN permanent purge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findImage.mockResolvedValue(legacyAdmin);
    mocks.deleteImage.mockResolvedValue(legacyAdmin);
    mocks.updateVehicle.mockResolvedValue({
      id: "vehicle-1",
      thumbnailImageId: null,
      thumbnailUrl: "",
      imageRevision: 1,
      updatedAt: new Date(UPDATED_AT.getTime() + 1),
    });
    mocks.withLocked.mockImplementation(async (_request, mutation) => mutation({
      vehicle: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "vehicle-1",
          thumbnailImageId: null,
          thumbnailUrl: "",
          imageRevision: 0,
          updatedAt: UPDATED_AT,
        }),
        update: mocks.updateVehicle,
      },
      vehicleImage: { findFirst: mocks.findImage, delete: mocks.deleteImage },
    }));
  });

  it("permanently deletes a backfilled ADMIN row without a storage path", async () => {
    const result = await purgeVehicleImage("vehicle-1", legacyAdmin.id, {
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      expectedImageRevision: 0,
    });
    expect(result).toEqual({
      before: legacyAdmin,
      storageCleanup: "deleted",
      imageRevision: 1,
      vehicleUpdatedAt: new Date(UPDATED_AT.getTime() + 1),
    });
    expect(mocks.deleteImage).toHaveBeenCalledWith({ where: { id: legacyAdmin.id } });
  });

  it("still forbids CARPAN2 purge before deleting its row", async () => {
    mocks.findImage.mockResolvedValue({ ...legacyAdmin, origin: "CARPAN2" });
    await expect(purgeVehicleImage("vehicle-1", legacyAdmin.id, {
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      expectedImageRevision: 0,
    })).rejects.toMatchObject({
      code: "CARPAN2_IMAGE_PURGE_FORBIDDEN",
    });
    expect(mocks.deleteImage).not.toHaveBeenCalled();
  });

  it("rejects a stale parent revision before enqueueing or deleting", async () => {
    mocks.withLocked.mockImplementation(async (_request, mutation) => mutation({
      vehicle: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "vehicle-1",
          thumbnailImageId: null,
          thumbnailUrl: "",
          imageRevision: 1,
          updatedAt: UPDATED_AT,
        }),
        update: mocks.updateVehicle,
      },
      vehicleImage: { findFirst: mocks.findImage, delete: mocks.deleteImage },
    }));

    await expect(purgeVehicleImage("vehicle-1", legacyAdmin.id, {
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      expectedImageRevision: 0,
    })).rejects.toMatchObject({ code: "STALE_IMAGE_REVISION", status: 409 });
    expect(mocks.deleteImage).not.toHaveBeenCalled();
    expect(mocks.updateVehicle).not.toHaveBeenCalled();
  });
});
