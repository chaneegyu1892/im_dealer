import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  updateToken: vi.fn(),
  findToken: vi.fn(),
  createUpload: vi.fn(),
  findUpload: vi.fn(),
  deleteUpload: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    reviewRequestToken: { findUnique: mocks.findToken },
    vehicle: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/supabase/storage", () => ({
  REVIEW_IMAGE_MAX_SIZE: 5,
  reviewImagePublicUrl: (path: string) => `https://cdn.example/review-images/${path}`,
}));

import {
  releaseReviewImageUpload,
  reserveReviewImageUpload,
} from "./review-token";

describe("review image upload ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback) => callback({
      reviewRequestToken: {
        updateMany: mocks.updateToken,
        findUnique: mocks.findToken,
      },
      reviewImageUpload: {
        create: mocks.createUpload,
        findUnique: mocks.findUpload,
        deleteMany: mocks.deleteUpload,
      },
    }));
  });

  it("atomically reserves a token-owned slot and byte budget before storage upload", async () => {
    mocks.updateToken.mockResolvedValue({ count: 1 });
    mocks.createUpload.mockImplementation(async ({ data }) => ({
      id: "upload-1",
      path: data.path,
      url: data.url,
    }));

    const reservation = await reserveReviewImageUpload({
      reviewRequestTokenId: "token-row-1",
      byteSize: 5,
      contentType: "image/jpeg",
    });

    expect(reservation).toMatchObject({
      ok: true,
      data: {
        id: "upload-1",
        path: expect.stringMatching(/^token-row-1\//),
        url: expect.stringMatching(/^https:\/\/cdn\.example\/review-images\/token-row-1\//),
      },
    });
    expect(mocks.updateToken).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "token-row-1",
        usedAt: null,
        revokedAt: null,
        imageUploadCount: { lt: 5 },
        imageUploadBytes: { lte: 20 },
      }),
      data: {
        imageUploadCount: { increment: 1 },
        imageUploadBytes: { increment: 5 },
      },
    });
  });

  it("does not create an object ledger row when the token quota is already exhausted", async () => {
    mocks.updateToken.mockResolvedValue({ count: 0 });
    mocks.findToken.mockResolvedValue({
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(reserveReviewImageUpload({
      reviewRequestTokenId: "token-row-1",
      byteSize: 5,
      contentType: "image/jpeg",
    })).resolves.toEqual({ ok: false, reason: "quota" });
    expect(mocks.createUpload).not.toHaveBeenCalled();
  });

  it("releases the reserved bytes and count when storage upload fails", async () => {
    mocks.findUpload.mockResolvedValue({
      id: "upload-1",
      reviewRequestTokenId: "token-row-1",
      byteSize: 5,
      usedAt: null,
    });
    mocks.deleteUpload.mockResolvedValue({ count: 1 });
    mocks.updateToken.mockResolvedValue({ count: 1 });

    await releaseReviewImageUpload("upload-1");

    expect(mocks.updateToken).toHaveBeenCalledWith({
      where: { id: "token-row-1" },
      data: {
        imageUploadCount: { decrement: 1 },
        imageUploadBytes: { decrement: 5 },
      },
    });
  });
});
