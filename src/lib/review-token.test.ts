import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  updateToken: vi.fn(),
  findToken: vi.fn(),
  findVehicle: vi.fn(),
  createUpload: vi.fn(),
  findUpload: vi.fn(),
  deleteUpload: vi.fn(),
  revokeTokens: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    reviewRequestToken: { findUnique: mocks.findToken },
    vehicle: { findUnique: mocks.findVehicle },
  },
}));

vi.mock("@/lib/supabase/storage", () => ({
  REVIEW_IMAGE_MAX_SIZE: 5,
  reviewImagePublicUrl: (path: string) => `https://cdn.example/review-images/${path}`,
}));

import {
  resolveReviewToken,
  revokeReviewTokensForQuote,
  releaseReviewImageUpload,
  reserveReviewImageUpload,
} from "./review-token";

function tokenRow(deletedAt: Date | null) {
  return {
    id: "token-row-1",
    savedQuoteId: "quote-1",
    usedAt: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    savedQuote: {
      id: "quote-1",
      customerName: "고객",
      createdAt: new Date(),
      vehicleId: null,
      deletedAt,
    },
  };
}

describe("review token lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a token whose parent quote was soft-deleted", async () => {
    mocks.findToken.mockResolvedValue(tokenRow(new Date()));

    await expect(resolveReviewToken("review-token")).resolves.toEqual({
      ok: false,
      reason: "revoked",
    });
  });

  it("continues to resolve an active quote token", async () => {
    mocks.findToken.mockResolvedValue(tokenRow(null));

    await expect(resolveReviewToken("review-token")).resolves.toMatchObject({
      ok: true,
      data: { savedQuoteId: "quote-1", customerName: "고객" },
    });
  });

  it("revokes active tokens through the caller's transaction client", async () => {
    mocks.revokeTokens.mockResolvedValue({ count: 2 });

    await expect(
      revokeReviewTokensForQuote("quote-1", {
        reviewRequestToken: { updateMany: mocks.revokeTokens },
      } as Pick<Prisma.TransactionClient, "reviewRequestToken">),
    ).resolves.toBe(2);

    expect(mocks.revokeTokens).toHaveBeenCalledWith({
      where: { savedQuoteId: "quote-1", usedAt: null, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

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
        savedQuote: { is: { deletedAt: null } },
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

  it("does not reserve an image for a token whose quote was deleted", async () => {
    mocks.updateToken.mockResolvedValue({ count: 0 });
    mocks.findToken.mockResolvedValue({
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      savedQuote: { deletedAt: new Date() },
    });

    await expect(reserveReviewImageUpload({
      reviewRequestTokenId: "token-row-1",
      byteSize: 5,
      contentType: "image/jpeg",
    })).resolves.toEqual({ ok: false, reason: "invalid" });
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
