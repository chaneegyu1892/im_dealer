import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    review: { findMany: mocks.findMany },
  },
}));

import { listPublicReviews } from "./reviews";

function reviewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "review-regular",
    authorRealName: "홍길동",
    rating: 5,
    content: "일반 후기입니다.",
    vehicleId: "vehicle-1",
    reviewDate: new Date("2026-07-01T00:00:00.000Z"),
    imageUrls: [],
    isBest: false,
    likeCount: 1,
    vehicle: { name: "쏘렌토", brand: "기아" },
    ...overrides,
  };
}

describe("listPublicReviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([reviewRow()]);
  });

  it("excludes Best reviews from the public gallery query", async () => {
    await listPublicReviews({ limit: 12, sort: "recent" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublic: true,
          isBest: false,
        }),
      })
    );
    expect(mocks.findMany.mock.calls[0]?.[0]?.where).not.toHaveProperty("OR");
  });

  it("does not pin the gallery on isBest sort", async () => {
    await listPublicReviews({ limit: 12, sort: "recent" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ reviewDate: "desc" }, { id: "desc" }],
      })
    );
  });

  it("keeps vehicle and rating filters while still excluding Best", async () => {
    await listPublicReviews({
      vehicleId: "vehicle-1",
      ratings: [5],
      withImages: true,
      sort: "popular",
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublic: true,
          isBest: false,
          vehicleId: "vehicle-1",
          rating: { in: [5] },
          imageUrls: { isEmpty: false },
        }),
        orderBy: [
          { likeCount: "desc" },
          { reviewDate: "desc" },
          { id: "desc" },
        ],
      })
    );
  });
});
