import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveReviewToken: vi.fn(),
  reserveReviewImageUpload: vi.fn(),
  releaseReviewImageUpload: vi.fn(),
  deleteReviewImage: vi.fn(),
  uploadReviewImage: vi.fn(),
  checkRateLimit: vi.fn(async (): Promise<Response | null> => null),
}));

vi.mock("@/lib/review-token", () => ({
  resolveReviewToken: mocks.resolveReviewToken,
  reserveReviewImageUpload: mocks.reserveReviewImageUpload,
  releaseReviewImageUpload: mocks.releaseReviewImageUpload,
  REVIEW_TOKEN_REASON_MESSAGE: {
    not_found: "유효하지 않은 링크입니다.",
    used: "이미 후기 작성이 완료된 링크입니다.",
    revoked: "사용이 중단된 링크입니다.",
    expired: "링크 사용 기간이 만료되었습니다.",
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  reviewImageRateLimit: {},
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/supabase/storage", () => ({
  REVIEW_IMAGE_MAX_SIZE: 5 * 1024 * 1024,
  REVIEW_IMAGE_ALLOWED_MIME: new Set(["image/jpeg", "image/png", "image/webp"]),
  deleteReviewImage: mocks.deleteReviewImage,
  uploadReviewImage: mocks.uploadReviewImage,
}));

import { POST } from "./route";

function request(): NextRequest {
  const file = new Blob(["image"], { type: "image/jpeg" });
  return {
    formData: async () => ({ get: () => file }),
  } as unknown as NextRequest;
}

describe("POST /api/reviews/submit/[token]/image", () => {
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
    mocks.reserveReviewImageUpload
      .mockResolvedValueOnce({ ok: true, data: { id: "upload-1", path: "review-token-1/one.jpg", url: "https://cdn.example/one.jpg" } })
      .mockResolvedValueOnce({ ok: true, data: { id: "upload-2", path: "review-token-1/two.jpg", url: "https://cdn.example/two.jpg" } })
      .mockResolvedValueOnce({ ok: true, data: { id: "upload-3", path: "review-token-1/three.jpg", url: "https://cdn.example/three.jpg" } })
      .mockResolvedValueOnce({ ok: true, data: { id: "upload-4", path: "review-token-1/four.jpg", url: "https://cdn.example/four.jpg" } })
      .mockResolvedValueOnce({ ok: true, data: { id: "upload-5", path: "review-token-1/five.jpg", url: "https://cdn.example/five.jpg" } })
      .mockResolvedValueOnce({ ok: false, reason: "quota" });
    mocks.uploadReviewImage.mockResolvedValue(undefined);
  });

  it("limits one review token to five cumulative image uploads", async () => {
    const responses = [];
    for (let index = 0; index < 6; index += 1) {
      responses.push(await POST(request(), { params: Promise.resolve({ token: "review-token" }) }));
    }

    expect(responses.slice(0, 5).map((response) => response.status)).toEqual([201, 201, 201, 201, 201]);
    expect(responses[5]?.status).toBe(429);
    expect(mocks.uploadReviewImage).toHaveBeenCalledTimes(5);
  });

  it("releases the ledger reservation and deletes a partial object when storage fails", async () => {
    mocks.reserveReviewImageUpload.mockReset();
    mocks.reserveReviewImageUpload.mockResolvedValue({
      ok: true,
      data: { id: "upload-1", path: "review-token-1/one.jpg", url: "https://cdn.example/one.jpg" },
    });
    mocks.uploadReviewImage.mockRejectedValue(new Error("storage unavailable"));
    mocks.deleteReviewImage.mockResolvedValue(undefined);
    mocks.releaseReviewImageUpload.mockResolvedValue(undefined);

    const response = await POST(request(), { params: Promise.resolve({ token: "review-token" }) });

    expect(response.status).toBe(500);
    expect(mocks.deleteReviewImage).toHaveBeenCalledWith("review-token-1/one.jpg");
    expect(mocks.releaseReviewImageUpload).toHaveBeenCalledWith("upload-1");
  });

  it("returns 429 after 20 image uploads in the current minute", async () => {
    let hits = 0;
    mocks.checkRateLimit.mockImplementation(async () => {
      hits += 1;
      if (hits <= 20) return null;
      return new Response(JSON.stringify({ error: "잠시 후 다시 시도해 주세요." }), {
        status: 429,
        headers: { "Retry-After": "60", "Content-Type": "application/json" },
      });
    });
    mocks.reserveReviewImageUpload.mockReset();
    mocks.reserveReviewImageUpload.mockResolvedValue({
      ok: true,
      data: { id: "upload-n", path: "review-token-1/n.jpg", url: "https://cdn.example/n.jpg" },
    });

    const statuses: number[] = [];
    for (let i = 0; i < 21; i += 1) {
      statuses.push(
        (await POST(request(), { params: Promise.resolve({ token: "review-token" }) })).status,
      );
    }

    expect(statuses.slice(0, 20).every((status) => status === 201)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    expect(mocks.uploadReviewImage).toHaveBeenCalledTimes(20);
  });
});
