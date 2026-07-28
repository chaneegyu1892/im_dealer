import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  checkRateLimit: vi.fn(),
  findSavedQuote: vi.fn(),
  buildOfficialImageData: vi.fn(),
  renderQuoteImageBuffer: vi.fn(),
}));

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

vi.mock("@/lib/rate-limit", () => ({
  strictRateLimit: null,
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { savedQuote: { findFirst: mocks.findSavedQuote } },
}));

vi.mock("@/lib/quote-delivery/official-image", () => ({
  buildOfficialDeliveryImageData: mocks.buildOfficialImageData,
}));

vi.mock("@/lib/quote-image/render-quote-image", () => ({
  renderQuoteImageBuffer: mocks.renderQuoteImageBuffer,
}));

function request(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/quote/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/quote/image official-quote authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveUser.mockResolvedValue({
      user: { id: "member-db-1", supabaseId: "member-1", email: "member@example.com" },
      error: null,
    });
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.findSavedQuote.mockResolvedValue(null);
    mocks.buildOfficialImageData.mockResolvedValue({
      ok: true,
      data: { vehicleName: "공식 차량" },
    });
    mocks.renderQuoteImageBuffer.mockResolvedValue(Buffer.from("png"));
  });

  it("blocks an inactive session before looking up or rendering a member-only quote image", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "비활성화된 계정입니다." }, { status: 403 }),
    });

    const response = await POST(request({ savedQuoteId: "quote-1", sessionId: "session-1" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "비활성화된 계정입니다." });
    expect(mocks.findSavedQuote).not.toHaveBeenCalled();
    expect(mocks.renderQuoteImageBuffer).not.toHaveBeenCalled();
  });

  it("does not render arbitrary client finance or vehicle values without an owned saved quote", async () => {
    const response = await POST(request({
      savedQuoteId: "victim-quote",
      sessionId: "victim-session",
      vehicleName: "위조 차량",
      monthlyPayment: 1,
    }));

    expect(response.status).toBe(403);
    expect(mocks.renderQuoteImageBuffer).not.toHaveBeenCalled();
  });

  it("renders only the server-owned saved quote and ignores extra client values", async () => {
    const savedQuote = {
      id: "quote-1",
      vehicleId: "vehicle-1",
      trimId: "trim-1",
      contractMonths: 48,
      annualMileage: 20_000,
      depositRate: 0,
      prepayRate: 0,
      contractType: "반납형",
      monthlyPayment: 650_000,
      pricingStatus: "CALCULATED",
      breakdown: {},
      exteriorColorId: null,
      interiorColorId: null,
    };
    mocks.findSavedQuote.mockResolvedValue(savedQuote);

    const response = await POST(request({
      savedQuoteId: "quote-1",
      sessionId: "session-1",
      vehicleName: "위조 차량",
      monthlyPayment: 1,
    }));

    expect(response.status).toBe(200);
    expect(mocks.buildOfficialImageData).toHaveBeenCalledWith(savedQuote);
    expect(mocks.renderQuoteImageBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleName: "공식 차량", userEmail: "member@example.com" })
    );
  });
});
