import { beforeEach, describe, expect, it, vi } from "vitest";

type Reservation = {
  readonly storagePath: string;
  readonly reason: "UPLOAD_ROLLBACK";
  status: "RESERVED" | "READY";
  reservationToken: string | null;
};

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  findUnique: vi.fn(),
  uploadObject: vi.fn(),
  withLocked: vi.fn(),
}));

const reservations = new Map<string, Reservation>();
const createdImageIds: string[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicleImageStorageCleanup: {
      create: mocks.create,
      updateMany: mocks.updateMany,
      deleteMany: mocks.deleteMany,
      findUnique: mocks.findUnique,
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

import { VehicleImageStorageError } from "@/lib/supabase/storage";
import { uploadVehicleImage } from "./upload";

const IMAGE = {
  id: "image-1",
  vehicleId: "vehicle-1",
  type: "COVER",
  origin: "ADMIN",
  title: "커버",
  storageUrl: "https://storage/image.webp",
  sourceUrl: null,
  sourceKey: "admin:path",
  adminStoragePath: "admin/vehicle-1/image.webp",
  displayOrder: 0,
  isVisible: true,
  deletedAt: null,
  metadata: null,
  createdAt: new Date("2026-07-13T00:00:00.000Z"),
  updatedAt: new Date("2026-07-13T00:00:00.000Z"),
};

function input() {
  return {
    file: new File(["image"], "image.webp", { type: "image/webp" }),
    title: "커버",
    type: "COVER" as const,
    isVisible: true,
  };
}

function currentReservation(): Reservation {
  const reservation = reservations.values().next().value;
  if (!reservation) throw new Error("missing test reservation");
  return reservation;
}

describe("upload reservation durability readback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reservations.clear();
    createdImageIds.splice(0);
    mocks.create.mockImplementation(({ data }: { readonly data: Reservation }) => {
      if (reservations.has(data.storagePath)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
      const reservation = { ...data };
      reservations.set(data.storagePath, reservation);
      return Promise.resolve(reservation);
    });
    mocks.updateMany.mockImplementation(({ where, data }: {
      readonly where: { readonly storagePath: string; readonly reservationToken: string; readonly status: "RESERVED" };
      readonly data: { readonly status: "READY"; readonly reservationToken: null };
    }) => {
      const reservation = reservations.get(where.storagePath);
      if (!reservation || reservation.status !== where.status || reservation.reservationToken !== where.reservationToken) {
        return Promise.resolve({ count: 0 });
      }
      reservation.status = data.status;
      reservation.reservationToken = data.reservationToken;
      return Promise.resolve({ count: 1 });
    });
    mocks.deleteMany.mockImplementation(({ where }: {
      readonly where: { readonly storagePath: string; readonly reservationToken: string; readonly status: "RESERVED" };
    }) => {
      const reservation = reservations.get(where.storagePath);
      if (!reservation || reservation.status !== where.status || reservation.reservationToken !== where.reservationToken) {
        return Promise.resolve({ count: 0 });
      }
      reservations.delete(where.storagePath);
      return Promise.resolve({ count: 1 });
    });
    mocks.findUnique.mockImplementation(({ where }: { readonly where: { readonly storagePath: string } }) => (
      Promise.resolve(reservations.get(where.storagePath) ?? null)
    ));
    mocks.uploadObject.mockResolvedValue(IMAGE.storageUrl);
    mocks.withLocked.mockImplementation(async (_request, mutation) => {
      const reservationSnapshot = new Map([...reservations].map(([path, row]) => [path, { ...row }]));
      const imageSnapshot = [...createdImageIds];
      try {
        return await mutation({
          vehicle: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "vehicle-1", thumbnailImageId: null, thumbnailUrl: "" }) },
          vehicleImage: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(() => {
              createdImageIds.push(IMAGE.id);
              return Promise.resolve(IMAGE);
            }),
          },
          vehicleImageStorageCleanup: { deleteMany: mocks.deleteMany },
        });
      } catch (error) {
        reservations.clear();
        for (const [path, row] of reservationSnapshot) reservations.set(path, row);
        createdImageIds.splice(0, createdImageIds.length, ...imageSnapshot);
        throw error;
      }
    });
  });

  it("readback shows READY after an ambiguous upload response", async () => {
    mocks.uploadObject.mockRejectedValue(new VehicleImageStorageError("upload", "response lost", true));
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toThrow("response lost");
    expect(currentReservation()).toMatchObject({ status: "READY", reservationToken: null });
  });

  it("fails closed and rolls back the image when its token is already lost to READY", async () => {
    mocks.uploadObject.mockImplementation(async () => {
      const reservation = currentReservation();
      reservation.status = "READY";
      reservation.reservationToken = null;
      return IMAGE.storageUrl;
    });
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toMatchObject({ code: "RESERVATION_CONFLICT" });
    expect(createdImageIds).toEqual([]);
    expect(currentReservation()).toMatchObject({ status: "READY", reservationToken: null });
  });

  it("does not overwrite a different live reservation token", async () => {
    mocks.uploadObject.mockImplementation(async () => {
      currentReservation().reservationToken = "different-live-token";
      return IMAGE.storageUrl;
    });
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toMatchObject({ code: "RESERVATION_CONFLICT" });
    expect(createdImageIds).toEqual([]);
    expect(currentReservation()).toMatchObject({ status: "RESERVED", reservationToken: "different-live-token" });
  });

  it("creates an ownerless READY cleanup row when the reservation is missing", async () => {
    mocks.uploadObject.mockImplementation(async () => {
      reservations.clear();
      return IMAGE.storageUrl;
    });
    await expect(uploadVehicleImage("vehicle-1", input())).rejects.toMatchObject({ code: "RESERVATION_CONFLICT" });
    expect(createdImageIds).toEqual([]);
    expect(currentReservation()).toMatchObject({ status: "READY", reservationToken: null });
  });
});
