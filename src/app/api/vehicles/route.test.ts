import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyVehicles: vi.fn(),
  countVehicles: vi.fn(),
  findRateSheets: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findMany: mocks.findManyVehicles, count: mocks.countVehicles },
    capitalRateSheet: { findMany: mocks.findRateSheets },
  },
}));

import { GET } from "./route";

const base = {
  name: "차량",
  brand: "테스트",
  category: "SUV",
  basePrice: 40_000_000,
  isPopular: false,
  description: null,
  trims: [],
  recConfigs: null,
} as const;

describe("GET /api/vehicles public thumbnail projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countVehicles.mockResolvedValue(5);
    mocks.findRateSheets.mockResolvedValue([]);
    mocks.findManyVehicles.mockResolvedValue([
      {
        ...base,
        id: "active",
        slug: "active",
        displayOrder: 0,
        thumbnailUrl: "/active.webp",
        thumbnailImageId: "image-active",
        thumbnailImage: { vehicleId: "active", isVisible: true, deletedAt: null, storageUrl: "/active.webp" },
        images: [],
        _count: { images: 1 },
      },
      {
        ...base,
        id: "legacy",
        slug: "legacy",
        displayOrder: 1,
        thumbnailUrl: "/legacy.webp",
        thumbnailImageId: null,
        thumbnailImage: null,
        images: [],
        _count: { images: 0 },
      },
      {
        ...base,
        id: "custom",
        slug: "custom",
        displayOrder: 2,
        thumbnailUrl: "/custom.webp",
        thumbnailImageId: null,
        thumbnailImage: null,
        images: [{ type: "MAIN", sourceUrl: "/unrelated-source.webp", storageUrl: "/unrelated.webp", isVisible: false, deletedAt: null }],
        _count: { images: 1 },
      },
      {
        ...base,
        id: "managed-active",
        slug: "managed-active",
        displayOrder: 3,
        thumbnailUrl: "/source.webp",
        thumbnailImageId: null,
        thumbnailImage: null,
        images: [{ type: "COVER", sourceUrl: "/source.webp", storageUrl: "/mirror.webp", isVisible: true, deletedAt: null }],
        _count: { images: 1 },
      },
      {
        ...base,
        id: "managed-deleted",
        slug: "managed-deleted",
        displayOrder: 4,
        thumbnailUrl: "/source.webp",
        thumbnailImageId: null,
        thumbnailImage: null,
        images: [{ type: "COVER", sourceUrl: "/source.webp", storageUrl: "/mirror.webp", isVisible: true, deletedAt: new Date("2026-07-13") }],
        _count: { images: 1 },
      },
    ]);
  });

  it("serializes linked, custom, and active managed rollout thumbnails without private rows", async () => {
    const response = await GET(new NextRequest("http://localhost/api/vehicles"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.map((vehicle: { readonly thumbnailUrl: string }) => vehicle.thumbnailUrl))
      .toEqual(["/active.webp", "/legacy.webp", "/custom.webp", "/source.webp", ""]);
    expect(body.data[0]).not.toHaveProperty("thumbnailImage");
    expect(body.data[0]).not.toHaveProperty("images");
    expect(body.data[0]).not.toHaveProperty("_count");
    expect(mocks.findManyVehicles.mock.calls[0]?.[0].include).toHaveProperty("_count");
  });
});
