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
  findNotification: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    adminNotification: {
      findFirst: mocks.findNotification,
      create: mocks.createNotification,
    },
  },
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
        customerName: "홍길동",
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
    mocks.findNotification.mockResolvedValue(null);
    mocks.createNotification.mockResolvedValue({ id: "notif-review-1" });
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

  it("rejects a token invalidated by its deleted parent quote", async () => {
    mocks.resolveReviewToken.mockResolvedValue({ ok: false, reason: "revoked" });

    const response = await POST(
      request([]),
      { params: Promise.resolve({ token: "review-token" }) },
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({ reason: "revoked" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("claims an active token only while its quote remains undeleted", async () => {
    mocks.findUploads.mockResolvedValue([]);
    mocks.claimToken.mockResolvedValue({ count: 1 });
    mocks.createReview.mockResolvedValue({ id: "review-1" });
    mocks.updateToken.mockResolvedValue({});

    const response = await POST(
      request([]),
      { params: Promise.resolve({ token: "review-token" }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.claimToken).toHaveBeenCalledWith({
      where: {
        id: "token-row-1",
        savedQuote: { is: { deletedAt: null } },
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(mocks.createReview).toHaveBeenCalled();
    expect(mocks.createNotification).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "NEW_REVIEW",
        title: "새로운 고객 후기",
        content: "홍○○님이 테스트 차량 후기를 제출했습니다. (5점)",
        linkUrl: "/admin/reviews?id=review-1",
      }),
    });
  });

  it("creates a NEW_REVIEW notification after a successful submit", async () => {
    mocks.findUploads.mockResolvedValue([]);
    mocks.claimToken.mockResolvedValue({ count: 1 });
    mocks.createReview.mockResolvedValue({ id: "review-1" });
    mocks.updateToken.mockResolvedValue({});

    const response = await POST(
      request([]),
      { params: Promise.resolve({ token: "review-token" }) },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      data: { reviewId: "review-1" },
    });
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    const payload = mocks.createNotification.mock.calls[0][0].data as {
      content: string;
    };
    expect(payload.content).not.toContain("홍길동");
    expect(payload.content).not.toMatch(/01\d/);
  });

  it("does not notify again when the used token is retried", async () => {
    mocks.findUploads.mockResolvedValue([]);
    mocks.claimToken
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mocks.createReview.mockResolvedValue({ id: "review-1" });
    mocks.updateToken.mockResolvedValue({});

    const first = await POST(
      request([]),
      { params: Promise.resolve({ token: "review-token" }) },
    );
    const second = await POST(
      request([]),
      { params: Promise.resolve({ token: "review-token" }) },
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(410);
    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createReview).toHaveBeenCalledTimes(1);
  });

  it("keeps the submit success response when the admin notification insert fails", async () => {
    mocks.findUploads.mockResolvedValue([]);
    mocks.claimToken.mockResolvedValue({ count: 1 });
    mocks.createReview.mockResolvedValue({ id: "review-1" });
    mocks.updateToken.mockResolvedValue({});
    mocks.createNotification.mockRejectedValue(new Error("notification insert failed"));

    const response = await POST(
      request([]),
      { params: Promise.resolve({ token: "review-token" }) },
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      data: { reviewId: "review-1" },
    });
  });
});
