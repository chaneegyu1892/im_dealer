import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    quoteDelivery: {
      findMany: mocks.findMany,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/quote-delivery/store", () => ({
  deleteQuoteImage: mocks.remove,
}));

import { cleanupExpiredQuoteImages } from "./lifecycle";

const now = new Date("2026-07-28T00:00:00.000Z");

describe("cleanupExpiredQuoteImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.update.mockResolvedValue({});
    mocks.remove.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects only rows beyond the seven-day retention window", async () => {
    const result = await cleanupExpiredQuoteImages({ now });

    expect(result).toMatchObject({
      retentionDays: 7,
      scanned: 0,
      deleted: 0,
      failures: [],
    });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        imageDeletedAt: null,
        OR: [
          { status: "SENT", sentAt: { lte: new Date("2026-07-21T00:00:00.000Z") } },
          {
            status: "SENT",
            sentAt: null,
            createdAt: { lte: new Date("2026-07-21T00:00:00.000Z") },
          },
          {
            status: { in: ["PENDING", "FAILED"] },
            createdAt: { lte: new Date("2026-07-21T00:00:00.000Z") },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        imagePath: true,
        status: true,
        createdAt: true,
        sentAt: true,
      },
    });
  });

  it("deletes an expired successful delivery and records lifecycle completion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.findMany.mockResolvedValue([
      {
        id: "delivery-old",
        imagePath: "deliveries/old.png",
        status: "SENT",
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
        sentAt: new Date("2026-07-10T00:00:00.000Z"),
      },
    ]);

    const result = await cleanupExpiredQuoteImages({ now });

    expect(result).toMatchObject({ scanned: 1, deleted: 1, failures: [] });
    expect(mocks.remove).toHaveBeenCalledWith("deliveries/old.png");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "delivery-old" },
      data: {
        imageDeletedAt: now,
        imageCleanupAttempts: { increment: 1 },
        imageCleanupLastAttemptAt: now,
        imageCleanupError: null,
      },
    });
  });

  it("records a cleanup failure and leaves the row retryable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.findMany.mockResolvedValue([
      {
        id: "delivery-retry",
        imagePath: "deliveries/retry.png",
        status: "SENT",
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
        sentAt: new Date("2026-07-10T00:00:00.000Z"),
      },
    ]);
    mocks.remove.mockRejectedValue(new Error("storage unavailable"));

    const result = await cleanupExpiredQuoteImages({ now });

    expect(result).toMatchObject({
      scanned: 1,
      deleted: 0,
      failures: [{ id: "delivery-retry", reason: "storage unavailable" }],
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "delivery-retry" },
      data: {
        imageCleanupAttempts: { increment: 1 },
        imageCleanupLastAttemptAt: now,
        imageCleanupError: "storage unavailable",
      },
    });
    expect(mocks.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageDeletedAt: expect.any(Date) }),
      })
    );
  });
});
