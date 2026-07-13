import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyVehicles: vi.fn(),
  findManyRankSurcharges: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vehicle: { findMany: mocks.findManyVehicles },
    rankSurchargeConfig: { findMany: mocks.findManyRankSurcharges },
  },
}));

import { loadOverlapCandidateSnapshot } from "./overlap-candidate-loader";

const base = {
  name: "차량",
  brand: "테스트",
  category: "SUV",
  isVisible: true,
  surchargeRate: 0,
  isPopular: false,
  recConfigs: null,
  trims: [],
  popularConfigs: [],
  imageUrls: ["/legacy-gallery.webp"],
} as const;

describe("loadOverlapCandidateSnapshot public image projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findManyRankSurcharges.mockResolvedValue([]);
    mocks.findManyVehicles.mockResolvedValue([
      {
        ...base,
        id: "active",
        slug: "active",
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
        thumbnailUrl: "/legacy.webp",
        thumbnailImageId: null,
        thumbnailImage: null,
        images: [],
        _count: { images: 0 },
      },
      {
        ...base,
        id: "hidden",
        slug: "hidden",
        thumbnailUrl: "/hidden.webp",
        thumbnailImageId: "image-hidden",
        thumbnailImage: { vehicleId: "hidden", isVisible: false, deletedAt: null, storageUrl: "/hidden.webp" },
        images: [],
        _count: { images: 1 },
      },
      {
        ...base,
        id: "managed-rollout",
        slug: "managed-rollout",
        thumbnailUrl: "/managed-source.webp",
        thumbnailImageId: null,
        thumbnailImage: null,
        images: [{ type: "COVER", sourceUrl: "/managed-source.webp", storageUrl: "/managed-mirror.webp", isVisible: true, deletedAt: null }],
        _count: { images: 1 },
      },
      {
        ...base,
        id: "custom-rollout",
        slug: "custom-rollout",
        thumbnailUrl: "/custom-407.webp",
        thumbnailImageId: null,
        thumbnailImage: null,
        images: [{ type: "MAIN", sourceUrl: "/other-source.webp", storageUrl: "/other.webp", isVisible: false, deletedAt: null }],
        _count: { images: 1 },
      },
    ]);
  });

  it("sanitizes new recommendation candidates without changing candidate order", async () => {
    const snapshot = await loadOverlapCandidateSnapshot();

    expect(snapshot.vehicles.map((vehicle) => ({
      slug: vehicle.slug,
      thumbnailUrl: vehicle.thumbnailUrl,
      imageUrls: vehicle.imageUrls,
    }))).toEqual([
      { slug: "active", thumbnailUrl: "/active.webp", imageUrls: [] },
      { slug: "legacy", thumbnailUrl: "/legacy.webp", imageUrls: ["/legacy-gallery.webp"] },
      { slug: "hidden", thumbnailUrl: "", imageUrls: [] },
      { slug: "managed-rollout", thumbnailUrl: "/managed-source.webp", imageUrls: [] },
      { slug: "custom-rollout", thumbnailUrl: "/custom-407.webp", imageUrls: [] },
    ]);
    expect(mocks.findManyVehicles.mock.calls[0]?.[0].include).toHaveProperty("thumbnailImage");
    expect(mocks.findManyVehicles.mock.calls[0]?.[0].include.images.select).toHaveProperty("sourceUrl", true);
  });
});
