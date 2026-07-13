import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { activeVehicle, type FindVehicleQuery, serializeRepresentative } from "./route.test-fixtures";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findRateSheets: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findUnique: mocks.findUnique },
    capitalRateSheet: { findMany: mocks.findRateSheets },
  },
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ slug: "active-car" }) };
const request = new NextRequest("http://localhost/api/vehicles/active-car");

describe("GET /api/vehicles/[slug] rollout thumbnail projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findRateSheets.mockResolvedValue([]);
  });

  it("preserves an unlinked managed source URL during the rollout window", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeVehicle,
      images: [{
        id: "image-cover",
        type: "COVER",
        title: "표지",
        sourceUrl: activeVehicle.thumbnailUrl,
        storageUrl: "https://cdn.example/mirrored-cover.jpg",
        displayOrder: 0,
        isVisible: true,
        deletedAt: null,
      }],
      _count: { images: 1 },
    });

    const payload = await (await GET(request, context)).json();

    expect(payload.data).toMatchObject({
      thumbnailUrl: activeVehicle.thumbnailUrl,
      legacyImageFallbackAllowed: false,
      heroImageProjectionAllowed: true,
      images: [{ storageUrl: "https://cdn.example/mirrored-cover.jpg" }],
    });
  });

  it("preserves a custom unlinked URL despite unrelated primary history", async () => {
    mocks.findUnique.mockResolvedValue({
      ...activeVehicle,
      images: [{
        id: "image-other",
        type: "MAIN",
        title: "다른 이미지",
        sourceUrl: "https://source.example/other.jpg",
        storageUrl: "https://cdn.example/other.jpg",
        displayOrder: 0,
        isVisible: false,
        deletedAt: null,
      }],
      _count: { images: 1 },
    });

    const payload = await (await GET(request, context)).json();

    expect(payload.data.thumbnailUrl).toBe(activeVehicle.thumbnailUrl);
    expect(payload.data.imageUrls).toEqual([]);
    expect(payload.data.images).toEqual([]);
  });

  it("fails closed for a cross-vehicle linked representative", async () => {
    mocks.findUnique.mockImplementation(async (query: FindVehicleQuery) => ({
      ...activeVehicle,
      thumbnailImageId: "representative-image",
      thumbnailImage: serializeRepresentative(query, {
        vehicleId: "vehicle-other",
        isVisible: true,
        deletedAt: null,
        storageUrl: activeVehicle.thumbnailUrl,
      }),
    }));

    const payload = await (await GET(request, context)).json();

    expect(payload.data.thumbnailUrl).toBe("");
    expect(payload.data).not.toHaveProperty("thumbnailImage");
  });
});
