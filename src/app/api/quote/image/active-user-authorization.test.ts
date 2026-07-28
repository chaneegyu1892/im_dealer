import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireActiveUser: vi.fn(),
  checkRateLimit: vi.fn(),
  buildQuoteImageData: vi.fn(),
  renderQuoteImageBuffer: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

vi.mock("@/lib/rate-limit", () => ({
  strictRateLimit: null,
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/quote-image/from-request", () => ({
  buildQuoteImageData: mocks.buildQuoteImageData,
}));

vi.mock("@/lib/quote-image/render-quote-image", () => ({
  renderQuoteImageBuffer: mocks.renderQuoteImageBuffer,
}));

describe("POST /api/quote/image active-account authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "inactive-member", email: "member@example.com" } } });
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "비활성화된 계정입니다." }, { status: 403 }),
    });
    mocks.checkRateLimit.mockResolvedValue(null);
    mocks.buildQuoteImageData.mockReturnValue({ vehicleName: "테스트 차량" });
    mocks.renderQuoteImageBuffer.mockResolvedValue(Buffer.from("png"));
  });

  it("blocks an inactive session before rendering a member-only quote image", async () => {
    const response = await POST(new NextRequest("https://example.com/api/quote/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleName: "테스트 차량" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "비활성화된 계정입니다." });
    expect(mocks.renderQuoteImageBuffer).not.toHaveBeenCalled();
  });
});
