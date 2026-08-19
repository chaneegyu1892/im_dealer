import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveReviewToken: vi.fn(),
  releaseReviewImageUpload: vi.fn(),
  deleteReviewImage: vi.fn(),
  findUploads: vi.fn(),
}));

vi.mock("@/lib/review-token", () => ({
  resolveReviewToken: mocks.resolveReviewToken,
  releaseReviewImageUpload: mocks.releaseReviewImageUpload,
  REVIEW_TOKEN_REASON_MESSAGE: {
    not_found: "유효하지 않은 링크입니다.",
    used: "이미 후기 작성이 완료된 링크입니다.",
    revoked: "사용이 중단된 링크입니다.",
    expired: "링크 사용 기간이 만료되었습니다.",
  },
}));

vi.mock("@/lib/supabase/storage", () => ({
  deleteReviewImage: mocks.deleteReviewImage,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reviewImageUpload: {
      findMany: mocks.findUploads,
    },
  },
}));

import { POST } from "./route";

function request(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/reviews/submit/review-token/image/release", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/reviews/submit/[token]/image/release", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveReviewToken.mockResolvedValue({
      ok: true,
      data: {
        id: "review-token-1",
        savedQuoteId: "quote-1",
        customerName: "고객",
        vehicleId: "vehicle-1",
        vehicleName: "테스트 차량",
        quoteCreatedAt: null,
      },
    });
    mocks.findUploads.mockResolvedValue([
      { id: "upload-1", path: "review-token-1/one.jpg" },
    ]);
    mocks.deleteReviewImage.mockResolvedValue(undefined);
    mocks.releaseReviewImageUpload.mockResolvedValue(undefined);
  });

  it("releases unused token-owned reservations and deletes the objects", async () => {
    const response = await POST(request({ uploadIds: ["upload-1"] }), {
      params: Promise.resolve({ token: "review-token" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.findUploads).toHaveBeenCalledWith({
      where: {
        id: { in: ["upload-1"] },
        reviewRequestTokenId: "review-token-1",
        usedAt: null,
      },
      select: { id: true, path: true },
    });
    expect(mocks.deleteReviewImage).toHaveBeenCalledWith("review-token-1/one.jpg");
    expect(mocks.releaseReviewImageUpload).toHaveBeenCalledWith("upload-1");
  });

  it("is idempotent: a second release of the same id does not touch the ledger again", async () => {
    mocks.findUploads
      .mockResolvedValueOnce([{ id: "upload-1", path: "review-token-1/one.jpg" }])
      .mockResolvedValueOnce([]);

    const first = await POST(request({ uploadIds: ["upload-1"] }), {
      params: Promise.resolve({ token: "review-token" }),
    });
    const second = await POST(request({ uploadIds: ["upload-1"] }), {
      params: Promise.resolve({ token: "review-token" }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.releaseReviewImageUpload).toHaveBeenCalledTimes(1);
    expect(mocks.deleteReviewImage).toHaveBeenCalledTimes(1);
  });

  it("does not fail the request when storage delete or ledger release throws", async () => {
    mocks.deleteReviewImage.mockRejectedValue(new Error("storage down"));
    mocks.releaseReviewImageUpload.mockRejectedValue(new Error("ledger down"));

    const response = await POST(request({ uploadIds: ["upload-1"] }), {
      params: Promise.resolve({ token: "review-token" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
  });
});
