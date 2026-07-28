import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reservationCreate: vi.fn(),
  reservationUpdateMany: vi.fn(),
  reservationDeleteMany: vi.fn(),
  reservationFindUnique: vi.fn(),
  uploadObject: vi.fn(),
  renderThumbnail: vi.fn(),
  withLocked: vi.fn(),
  vehicleFind: vi.fn(),
  imageFind: vi.fn(),
  imageCreate: vi.fn(),
  txReservationDelete: vi.fn(),
  vehicleUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicleImageStorageCleanup: {
      create: mocks.reservationCreate,
      updateMany: mocks.reservationUpdateMany,
      deleteMany: mocks.reservationDeleteMany,
      findUnique: mocks.reservationFindUnique,
    },
  },
}));
vi.mock("@/lib/supabase/storage", () => ({
  ADMIN_UPLOAD_ALLOWED_MIME: new Set(["image/webp"]),
  ADMIN_UPLOAD_MAX_SIZE: 5 * 1024 * 1024,
  VehicleImageStorageError: class VehicleImageStorageError extends Error {
    constructor(readonly operation: string, message: string, readonly objectMayExist = false) {
      super(message);
    }
  },
  uploadVehicleImageObject: mocks.uploadObject,
}));
vi.mock("./transaction", () => ({ withLockedVehicleImages: mocks.withLocked }));
vi.mock("./list-thumbnail", () => ({
  VEHICLE_LIST_THUMBNAIL_CONTENT_TYPE: "image/webp",
  renderVehicleListThumbnail: mocks.renderThumbnail,
  vehicleListThumbnailPath: (path: string) => `list-thumbnails/v1/${path.replace(/\.[^.]+$/, ".webp")}`,
}));

import { uploadVehicleImage } from "./upload";
import { VehicleImageStorageError } from "@/lib/supabase/storage";

const NOW = new Date("2026-07-13T00:00:00.000Z");
const created = {
  id: "image-1",
  vehicleId: "vehicle-1",
  type: "COVER",
  origin: "ADMIN",
  title: "커버",
  storageUrl: "https://storage/image.webp",
  sourceUrl: null,
  sourceKey: "admin:path",
  adminStoragePath: "admin/vehicle-1/image.webp",
  listThumbnailUrl: "https://storage/list-thumbnail.webp",
  listThumbnailStoragePath: "list-thumbnails/v1/admin/vehicle-1/image.webp",
  displayOrder: 0,
  isVisible: true,
  deletedAt: null,
  metadata: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function input() {
  const file = new File(["image"], "image.webp", { type: "image/webp" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => Uint8Array.from([1, 2, 3]).buffer,
  });
  return {
    file,
    title: "커버",
    type: "COVER" as const,
    isVisible: true,
  };
}

describe("vehicle image upload reservation protocol", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reservationCreate.mockResolvedValue({ id: "reservation-1" });
    mocks.reservationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.reservationDeleteMany.mockResolvedValue({ count: 1 });
    mocks.reservationFindUnique.mockResolvedValue({ status: "READY", reservationToken: null });
    mocks.renderThumbnail.mockResolvedValue(Uint8Array.from([4, 5, 6]));
    mocks.uploadObject.mockImplementation(async ({ contentType }: { contentType: string }) =>
      contentType === "image/webp" && mocks.uploadObject.mock.calls.length === 2
        ? created.listThumbnailUrl
        : created.storageUrl);
    mocks.vehicleFind.mockResolvedValue({
      id: "vehicle-1",
      thumbnailImageId: null,
      thumbnailUrl: "",
      imageRevision: 0,
      updatedAt: NOW,
    });
    mocks.imageFind.mockResolvedValue(null);
    mocks.imageCreate.mockResolvedValue(created);
    mocks.txReservationDelete.mockResolvedValue({ count: 1 });
    mocks.vehicleUpdate.mockResolvedValue({
      id: "vehicle-1",
      thumbnailImageId: null,
      thumbnailUrl: "",
      imageRevision: 1,
      updatedAt: new Date(NOW.getTime() + 1),
    });
    mocks.withLocked.mockImplementation(async (_request, mutation) => mutation({
      vehicle: { findUniqueOrThrow: mocks.vehicleFind, update: mocks.vehicleUpdate },
      vehicleImage: { findFirst: mocks.imageFind, create: mocks.imageCreate },
      vehicleImageStorageCleanup: { deleteMany: mocks.txReservationDelete },
    }));
  });

  it("creates the ADMIN row and removes only its matching RESERVED token", async () => {
    const result = await uploadVehicleImage("vehicle-1", input());
    expect(result).toEqual({ image: created, imageRevision: 1, vehicleUpdatedAt: new Date(NOW.getTime() + 1) });
    expect(mocks.reservationCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      reason: "UPLOAD_ROLLBACK",
      status: "RESERVED",
      reservationToken: expect.any(String),
    }) });
    expect(mocks.reservationCreate).toHaveBeenCalledTimes(2);
    expect(mocks.uploadObject).toHaveBeenCalledTimes(2);
    expect(mocks.imageCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      origin: "ADMIN",
      adminStoragePath: expect.stringMatching(/^admin\/vehicle-1\//),
      listThumbnailUrl: created.listThumbnailUrl,
      listThumbnailStoragePath: expect.stringMatching(/^list-thumbnails\/v1\/admin\/vehicle-1\//),
    }) });
    expect(mocks.txReservationDelete).toHaveBeenCalledWith({ where: expect.objectContaining({ status: "RESERVED", reservationToken: expect.any(String) }) });
    expect(mocks.vehicleUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "vehicle-1" },
      data: { imageRevision: { increment: 1 } },
    }));
  });

  it("deletes the empty reservation when storage upload fails", async () => {
    mocks.uploadObject.mockRejectedValue(new VehicleImageStorageError("upload", "upload rejected", false));
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toThrow("upload rejected");
    expect(mocks.reservationDeleteMany).toHaveBeenCalledWith({ where: expect.objectContaining({ status: "RESERVED" }) });
    expect(mocks.reservationUpdateMany).not.toHaveBeenCalled();
  });

  it("fails closed when deterministic rejection cannot release its reservation", async () => {
    mocks.uploadObject.mockRejectedValue(new VehicleImageStorageError("upload", "upload rejected", false));
    mocks.reservationDeleteMany.mockResolvedValue({ count: 0 });
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toMatchObject({
      code: "RESERVATION_CONFLICT",
    });
  });

  it("keeps an ambiguous upload failure as a durable READY rollback", async () => {
    mocks.uploadObject.mockRejectedValue(new VehicleImageStorageError("upload", "network lost", true));
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toThrow("network lost");
    expect(mocks.reservationDeleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: "RESERVED",
        storagePath: expect.stringMatching(/^list-thumbnails\/v1\//),
      }),
    });
    expect(mocks.reservationUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "READY" }),
    }));
  });

  it("CAS transitions the matching reservation to READY when DB create fails", async () => {
    mocks.imageCreate.mockRejectedValue(new Error("database unavailable"));
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toThrow("database unavailable");
    expect(mocks.reservationUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: "RESERVED", reservationToken: expect.any(String) }),
      data: expect.objectContaining({ status: "READY", reservationToken: null }),
    });
  });

  it("rejects a wrong reservation token after durable readback", async () => {
    mocks.txReservationDelete.mockResolvedValue({ count: 0 });
    mocks.reservationUpdateMany.mockResolvedValue({ count: 0 });
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toMatchObject({
      code: "RESERVATION_CONFLICT",
    });
    expect(mocks.reservationFindUnique).toHaveBeenCalledTimes(2);
  });

  it("extends the RESERVED deadline while storage upload is active", async () => {
    vi.useFakeTimers();
    let finishUpload: ((value: string) => void) | undefined;
    mocks.uploadObject.mockReturnValue(new Promise<string>((resolve) => {
      finishUpload = resolve;
    }));
    const pending = uploadVehicleImage("vehicle-1", input());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.reservationUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: "RESERVED", reservationToken: expect.any(String) }),
      data: { availableAt: expect.any(Date) },
    });
    if (finishUpload) finishUpload(created.storageUrl);
    await pending;
  });
});
