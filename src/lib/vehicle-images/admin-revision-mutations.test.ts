import type { VehicleImage } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  withLocked: vi.fn(),
  vehicleFind: vi.fn(),
  vehicleUpdate: vi.fn(),
  imageFindFirst: vi.fn(),
  imageFindMany: vi.fn(),
  imageFindUniqueOrThrow: vi.fn(),
  imageUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./transaction", () => ({ withLockedVehicleImages: mocks.withLocked }));

import {
  editVehicleImage,
  restoreVehicleImage,
  setVehicleImageVisibility,
  trashVehicleImage,
} from "./item-mutations";
import { reorderVehicleImages } from "./ordering";
import { setVehicleRepresentative } from "./representative";

const T0 = new Date("2099-01-01T00:00:00.000Z");
const T1 = new Date("2099-01-01T00:00:00.001Z");

function image(overrides: Partial<VehicleImage> = {}): VehicleImage {
  return {
    id: "image-1",
    vehicleId: "vehicle-1",
    type: "MAIN",
    origin: "ADMIN",
    title: "기존 제목",
    storageUrl: "/image.webp",
    sourceUrl: null,
    sourceKey: "admin:image-1",
    adminStoragePath: "admin/vehicle-1/image.webp",
    listThumbnailUrl: "/list-thumbnail.webp",
    listThumbnailStoragePath: "list-thumbnails/v1/admin/vehicle-1/image.webp",
    displayOrder: 0,
    isVisible: true,
    deletedAt: null,
    metadata: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function vehicle(overrides: object = {}) {
  return {
    id: "vehicle-1",
    thumbnailImageId: null,
    thumbnailUrl: "",
    imageRevision: 0,
    updatedAt: T0,
    ...overrides,
  };
}

function transaction() {
  return {
    vehicle: { findUniqueOrThrow: mocks.vehicleFind, update: mocks.vehicleUpdate },
    vehicleImage: {
      findFirst: mocks.imageFindFirst,
      findMany: mocks.imageFindMany,
      findUniqueOrThrow: mocks.imageFindUniqueOrThrow,
      update: mocks.imageUpdate,
    },
  };
}

describe("admin VehicleImage parent revision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const row = image();
    mocks.vehicleFind.mockResolvedValue(vehicle());
    mocks.vehicleUpdate.mockResolvedValue(vehicle({ imageRevision: 1, updatedAt: T1 }));
    mocks.imageFindFirst.mockResolvedValue(row);
    mocks.imageFindMany.mockResolvedValue([row]);
    mocks.imageFindUniqueOrThrow.mockResolvedValue(row);
    mocks.imageUpdate.mockResolvedValue(row);
    mocks.withLocked.mockImplementation(async (_request, mutation) => mutation(transaction()));
  });

  it("bumps the parent after a visibility change", async () => {
    // Given / When
    const result = await setVehicleImageVisibility("vehicle-1", "image-1", {
      expectedUpdatedAt: T0.toISOString(),
      expectedImageRevision: 0,
      isVisible: false,
    });

    // Then
    expect(result.vehicleUpdatedAt).toEqual(T1);
    expect(result.imageRevision).toBe(1);
    expect(mocks.imageUpdate).toHaveBeenCalledOnce();
    expect(mocks.vehicleUpdate).toHaveBeenCalledOnce();
  });

  it("does not bump the parent for an accepted visibility no-op", async () => {
    // Given / When
    const result = await setVehicleImageVisibility("vehicle-1", "image-1", {
      expectedUpdatedAt: T0.toISOString(),
      expectedImageRevision: 0,
      isVisible: true,
    });

    // Then
    expect(result.vehicleUpdatedAt).toEqual(T0);
    expect(result.imageRevision).toBe(0);
    expect(mocks.imageUpdate).not.toHaveBeenCalled();
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });

  it("does not bump the parent when optimistic image state is stale", async () => {
    // Given / When
    const action = setVehicleImageVisibility("vehicle-1", "image-1", {
      expectedUpdatedAt: new Date(T0.getTime() - 1).toISOString(),
      expectedImageRevision: 0,
      isVisible: false,
    });

    // Then
    await expect(action).rejects.toMatchObject({ code: "STALE_IMAGE_STATE" });
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });

  it("rejects a stale parent revision even when the targeted row version still matches", async () => {
    // Given
    mocks.vehicleFind.mockResolvedValue(vehicle({ imageRevision: 1, updatedAt: T1 }));

    // When
    const action = setVehicleImageVisibility("vehicle-1", "image-1", {
      expectedUpdatedAt: T0.toISOString(),
      expectedImageRevision: 0,
      isVisible: false,
    });

    // Then
    await expect(action).rejects.toMatchObject({ code: "STALE_IMAGE_REVISION", status: 409 });
    expect(mocks.imageUpdate).not.toHaveBeenCalled();
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["edit", () => editVehicleImage("vehicle-1", "image-1", {
      expectedUpdatedAt: T0.toISOString(), expectedImageRevision: 0, title: "새 제목",
    })],
    ["trash", () => trashVehicleImage("vehicle-1", "image-1", {
      expectedUpdatedAt: T0.toISOString(), expectedImageRevision: 0,
    })],
    ["restore", () => {
      mocks.imageFindFirst.mockResolvedValue(image({ deletedAt: T0 }));
      return restoreVehicleImage("vehicle-1", "image-1", {
        expectedUpdatedAt: T0.toISOString(), expectedImageRevision: 0,
      });
    }],
    ["reorder", () => reorderVehicleImages("vehicle-1", {
      group: "PRIMARY",
      expectedImageRevision: 0,
      items: [{ id: "image-1", expectedUpdatedAt: T0.toISOString() }],
    })],
  ])("rejects stale parent revision before %s writes", async (_label, action) => {
    // Given
    mocks.vehicleFind.mockResolvedValue(vehicle({ imageRevision: 1, updatedAt: T1 }));

    // When / Then
    await expect(action()).rejects.toMatchObject({ code: "STALE_IMAGE_REVISION", status: 409 });
    expect(mocks.imageUpdate).not.toHaveBeenCalled();
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ["trash", () => trashVehicleImage("vehicle-1", "image-1", { expectedUpdatedAt: T0.toISOString(), expectedImageRevision: 0 })],
    ["restore", () => {
      mocks.imageFindFirst.mockResolvedValue(image({ deletedAt: new Date(T0.getTime() - 1) }));
      return restoreVehicleImage("vehicle-1", "image-1", { expectedUpdatedAt: T0.toISOString(), expectedImageRevision: 0 });
    }],
  ])("bumps the parent after %s", async (_label, action) => {
    // Given / When
    const result = await action();

    // Then
    expect(result.vehicleUpdatedAt).toEqual(T1);
    expect(result.imageRevision).toBe(1);
    expect(mocks.vehicleUpdate).toHaveBeenCalledOnce();
  });

  it("bumps an actual edit but not an edit whose values already match", async () => {
    // Given
    mocks.imageFindUniqueOrThrow.mockResolvedValue(image({ title: "새 제목", updatedAt: T1 }));

    // When
    const changed = await editVehicleImage("vehicle-1", "image-1", {
      expectedUpdatedAt: T0.toISOString(),
      expectedImageRevision: 0,
      title: "새 제목",
    });

    // Then
    expect(changed.vehicleUpdatedAt).toEqual(T1);
    expect(changed.imageRevision).toBe(1);
    expect(mocks.vehicleUpdate).toHaveBeenCalledOnce();

    // Given / When
    vi.clearAllMocks();
    mocks.vehicleFind.mockResolvedValue(vehicle());
    mocks.imageFindFirst.mockResolvedValue(image());
    mocks.withLocked.mockImplementation(async (_request, mutation) => mutation(transaction()));
    const unchanged = await editVehicleImage("vehicle-1", "image-1", {
      expectedUpdatedAt: T0.toISOString(),
      expectedImageRevision: 0,
      title: "기존 제목",
    });

    // Then
    expect(unchanged.vehicleUpdatedAt).toEqual(T0);
    expect(unchanged.imageRevision).toBe(0);
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });

  it("bumps an actual reorder but not an already normalized order", async () => {
    // Given
    const second = image({ id: "image-2", displayOrder: 1, sourceKey: "admin:image-2" });
    mocks.imageFindMany.mockResolvedValue([image(), second]);

    // When
    const changed = await reorderVehicleImages("vehicle-1", {
      group: "PRIMARY",
      expectedImageRevision: 0,
      items: [
        { id: second.id, expectedUpdatedAt: T0.toISOString() },
        { id: "image-1", expectedUpdatedAt: T0.toISOString() },
      ],
    });

    // Then
    expect(changed.vehicleUpdatedAt).toEqual(T1);
    expect(changed.imageRevision).toBe(1);
    expect(mocks.vehicleUpdate).toHaveBeenCalledOnce();

    // Given / When
    vi.clearAllMocks();
    mocks.vehicleFind.mockResolvedValue(vehicle());
    mocks.imageFindMany.mockResolvedValue([image(), second]);
    mocks.withLocked.mockImplementation(async (_request, mutation) => mutation(transaction()));
    const unchanged = await reorderVehicleImages("vehicle-1", {
      group: "PRIMARY",
      expectedImageRevision: 0,
      items: [
        { id: "image-1", expectedUpdatedAt: T0.toISOString() },
        { id: second.id, expectedUpdatedAt: T0.toISOString() },
      ],
    });

    // Then
    expect(unchanged.vehicleUpdatedAt).toEqual(T0);
    expect(unchanged.imageRevision).toBe(0);
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });

  it("bumps representative selection, preserves no-op revision, and rejects stale state without a bump", async () => {
    // Given / When
    const selected = await setVehicleRepresentative("vehicle-1", "image-1", {
      expectedImageUpdatedAt: T0.toISOString(),
      expectedImageRevision: 0,
      expectedVehicleUpdatedAt: T0.toISOString(),
    });

    // Then
    expect(selected.vehicle.updatedAt).toEqual(T1);
    expect(selected.vehicle.imageRevision).toBe(1);
    expect(mocks.vehicleUpdate).toHaveBeenCalledOnce();

    // Given / When
    vi.clearAllMocks();
    mocks.vehicleFind.mockResolvedValue(vehicle({ thumbnailImageId: "image-1", thumbnailUrl: "/image.webp" }));
    mocks.imageFindFirst.mockResolvedValue(image());
    mocks.withLocked.mockImplementation(async (_request, mutation) => mutation(transaction()));
    const unchanged = await setVehicleRepresentative("vehicle-1", "image-1", {
      expectedImageUpdatedAt: T0.toISOString(),
      expectedImageRevision: 0,
      expectedVehicleUpdatedAt: T0.toISOString(),
    });

    // Then
    expect(unchanged.vehicle.updatedAt).toEqual(T0);
    expect(unchanged.vehicle.imageRevision).toBe(0);
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();

    // Given / When / Then
    await expect(setVehicleRepresentative("vehicle-1", "image-1", {
      expectedImageUpdatedAt: T0.toISOString(),
      expectedImageRevision: 0,
      expectedVehicleUpdatedAt: new Date(T0.getTime() - 1).toISOString(),
    })).rejects.toMatchObject({ code: "STALE_VEHICLE_STATE" });
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });

  it("rejects a stale representative image revision before update", async () => {
    await expect(setVehicleRepresentative("vehicle-1", "image-1", {
      expectedImageUpdatedAt: T0.toISOString(),
      expectedImageRevision: 9,
      expectedVehicleUpdatedAt: T0.toISOString(),
    })).rejects.toMatchObject({ code: "STALE_IMAGE_REVISION", status: 409 });
    expect(mocks.vehicleUpdate).not.toHaveBeenCalled();
  });
});
