import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findVehicle: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { vehicle: { findUnique: mocks.findVehicle } },
}));

import { listVehicleImages } from "./item-mutations";

const CREATED_AT = new Date("2026-07-12T00:00:00.000Z");
const UPDATED_AT = new Date("2026-07-13T00:00:00.000Z");

describe("listVehicleImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findVehicle.mockResolvedValue({
      thumbnailImageId: null,
      thumbnailUrl: "https://legacy.example/representative.webp",
      imageRevision: 7,
      updatedAt: UPDATED_AT,
      images: [{
        id: "image-main",
        type: "MAIN",
        origin: "ADMIN",
        title: "기존 대표 이미지",
        storageUrl: "https://legacy.example/main.webp",
        sourceUrl: null,
        sourceKey: "legacy:main",
        adminStoragePath: "must-not-leak",
        displayOrder: 0,
        isVisible: true,
        deletedAt: null,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      }],
    });
  });

  it("returns the authoritative legacy representative state from one minimal read", async () => {
    const result = await listVehicleImages("vehicle-1");

    expect(mocks.findVehicle).toHaveBeenCalledWith({
      where: { id: "vehicle-1" },
      select: {
        thumbnailImageId: true,
        thumbnailUrl: true,
        imageRevision: true,
        updatedAt: true,
        images: {
          orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            type: true,
            origin: true,
            title: true,
            storageUrl: true,
            sourceUrl: true,
            sourceKey: true,
            displayOrder: true,
            isVisible: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    expect(result).toEqual({
      thumbnailImageId: null,
      thumbnailUrl: "https://legacy.example/representative.webp",
      imageRevision: 7,
      vehicleUpdatedAt: UPDATED_AT.toISOString(),
      images: [{
        id: "image-main",
        type: "MAIN",
        origin: "ADMIN",
        title: "기존 대표 이미지",
        storageUrl: "https://legacy.example/main.webp",
        sourceUrl: null,
        sourceKey: "legacy:main",
        displayOrder: 0,
        isVisible: true,
        deletedAt: null,
        createdAt: CREATED_AT.toISOString(),
        updatedAt: UPDATED_AT.toISOString(),
        isRepresentative: false,
      }],
    });
    expect(JSON.stringify(result)).not.toContain("adminStoragePath");
  });
});
