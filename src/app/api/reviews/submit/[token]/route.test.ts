import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveReviewToken: vi.fn(),
  transaction: vi.fn(),
  findUploads: vi.fn(),
  claimToken: vi.fn(),
  createReview: vi.fn(),
  updateToken: vi.fn(),
  markUploads: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/review-token", () => ({
  resolveReviewToken: mocks.resolveReviewToken,
  REVIEW_TOKEN_REASON_MESSAGE: {
    not_found: "유효하지 않은 링크입니다.",
    used: "이미 후기 작성이 완료된 링크입니다.",
    revoked: "사용이 중단된 링크입니다.",
    expired: "링크 사용 기간이 만료되었습니다.",
  },
}));

vi.mock("@/lib/supabase/storage", () => ({
  isReviewImagePublicUrl: () => true,
}));

import { POST } from "./route";

function request(imageUrls: string[]): NextRequest {
  return new NextRequest("https://example.com/api/reviews/submit/review-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rating: 5,
      content: "충분히 긴 후기 내용입니다.",
      imageUrls,
    }),
  });
}

describe("POST /api/reviews/submit/[token] image ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveReviewToken.mockResolvedValue({
      ok: true,
      data: {
        id: "token-row-1",
        savedQuoteId: "quote-1",
        customerName: "고객",
        vehicleId: "vehicle-1",
        vehicleName: "테스트 차량",
        quoteCreatedAt: null,
      },
    });
    mocks.transaction.mockImplementation(async (callback) => callback({
      reviewImageUpload: {
        findMany: mocks.findUploads,
        updateMany: mocks.markUploads,
      },
      reviewRequestToken: {
        updateMany: mocks.claimToken,
        update: mocks.updateToken,
      },
      review: { create: mocks.createReview },
    }));
  });

  it("rejects a public review image URL that is not in this token's upload ledger", async () => {
    mocks.findUploads.mockResolvedValue([]);

    const response = await POST(
      request(["https://cdn.example/review-images/another-token/image.jpg"]),
      { params: Promise.resolve({ token: "review-token" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "이 링크에서 업로드한 이미지만 첨부할 수 있습니다.",
    });
    expect(mocks.claimToken).not.toHaveBeenCalled();
    expect(mocks.createReview).not.toHaveBeenCalled();
  });
});
