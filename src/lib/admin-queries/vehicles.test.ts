import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("../prisma", () => ({
  prisma: { vehicle: { findUnique: mocks.findUnique } },
}));

import { getVehicleById } from "./vehicles";

const createdAt = new Date("2026-07-10T00:00:00.000Z");
const updatedAt = new Date("2026-07-12T00:00:00.000Z");

function vehicleFixture() {
  return {
    id: "vehicle-1",
    slug: "sorento",
    name: "쏘렌토",
    brand: "기아",
    category: "SUV",
    vehicleCode: "MQ4",
    basePrice: 40_000_000,
    thumbnailUrl: "/cover.webp",
    thumbnailImageId: "image-cover",
    imageRevision: 7,
    imageUrls: ["/legacy.webp"],
    surchargeRate: 0,
    isVisible: true,
    isPopular: false,
    isSpotlight: false,
    slidingDoorOverride: null,
    advancedSafetyOverride: null,
    displayOrder: 0,
    tags: [],
    description: null,
    createdAt,
    updatedAt,
    lineups: [],
    trims: [],
    colors: [],
    images: [
      {
        id: "image-cover",
        vehicleId: "vehicle-1",
        type: "COVER",
        origin: "CARPAN2",
        title: "커버",
        storageUrl: "/cover.webp",
        sourceUrl: "https://source/cover.webp",
        sourceKey: "cover",
        adminStoragePath: null,
        displayOrder: 0,
        isVisible: false,
        deletedAt: null,
        metadata: null,
        createdAt,
        updatedAt,
      },
      {
        id: "image-trash",
        vehicleId: "vehicle-1",
        type: "MAIN",
        origin: "ADMIN",
        title: null,
        storageUrl: "/trash.webp",
        sourceUrl: null,
        sourceKey: "admin:trash",
        adminStoragePath: "vehicle-1/trash.webp",
        displayOrder: 1,
        isVisible: true,
        deletedAt: updatedAt,
        metadata: null,
        createdAt,
        updatedAt,
      },
    ],
  };
}

describe("getVehicleById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(vehicleFixture());
  });

  it("maps active, hidden, and deleted images without exposing storage paths", async () => {
    const result = await getVehicleById("vehicle-1");

    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          images: { orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }] },
        }),
      })
    );
    expect(result?.thumbnailImageId).toBe("image-cover");
    expect(result?.imageRevision).toBe(7);
    expect(result?.images).toEqual([
      expect.objectContaining({
        id: "image-cover",
        origin: "CARPAN2",
        isVisible: false,
        deletedAt: null,
        isRepresentative: true,
      }),
      expect.objectContaining({
        id: "image-trash",
        origin: "ADMIN",
        deletedAt: updatedAt.toISOString(),
        isRepresentative: false,
      }),
    ]);
    expect(result?.images[1]).not.toHaveProperty("adminStoragePath");
  });
});
