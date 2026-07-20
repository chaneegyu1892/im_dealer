import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findMember: vi.fn(),
  createDelivery: vi.fn(),
  updateDelivery: vi.fn(),
  render: vi.fn(),
  upload: vi.fn(),
  getAccessToken: vi.fn(),
  sendMemo: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findMember },
    quoteDelivery: { create: mocks.createDelivery, update: mocks.updateDelivery },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock("@/lib/quote-image/render-quote-image", () => ({
  renderQuoteImageBuffer: mocks.render,
}));

vi.mock("@/lib/quote-delivery/store", () => ({ uploadQuoteImage: mocks.upload }));
vi.mock("@/lib/kakao/token", () => ({ getKakaoAccessToken: mocks.getAccessToken }));
vi.mock("@/lib/kakao/memo", () => ({ sendQuoteMemo: mocks.sendMemo }));
vi.mock("@/lib/rate-limit", () => ({
  strictRateLimit: {},
  checkRateLimit: vi.fn(async () => null),
}));

function request(body?: Record<string, unknown>): NextRequest {
  return new NextRequest("https://example.com/api/quote/deliver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      body ?? {
        vehicleName: "쏘렌토",
        scenarios: { standard: { monthlyPayment: 500000 } },
        savedQuoteId: "quote-1",
      }
    ),
  });
}

describe("POST /api/quote/deliver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "sb-1", email: "a@b.com" } } });
    mocks.findMember.mockResolvedValue({ id: "user-1" });
    mocks.getAccessToken.mockResolvedValue("access-token");
    mocks.render.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.upload.mockResolvedValue({ path: "sb-1/img.png", url: "https://cdn/img.png" });
    mocks.createDelivery.mockResolvedValue({ id: "delivery-1" });
    mocks.updateDelivery.mockResolvedValue({});
    mocks.sendMemo.mockResolvedValue({ ok: true, reason: null });
  });

  it("비로그인은 401", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("필수 견적 정보가 없으면 400", async () => {
    const res = await POST(request({ vehicleName: "쏘렌토" }));
    expect(res.status).toBe(400);
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("회원 행이 없으면 404", async () => {
    mocks.findMember.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(404);
  });

  it("토큰 재발급 실패는 409 + 재로그인 코드, 렌더링은 시작조차 안 한다", async () => {
    mocks.getAccessToken.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "KAKAO_REAUTH_REQUIRED" });
    expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("성공하면 업로드한 이미지 URL로 발송하고 SENT 로 기록한다", async () => {
    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { deliveryId: "delivery-1" } });

    expect(mocks.upload).toHaveBeenCalledWith({ supabaseId: "sb-1", png: expect.any(Uint8Array) });
    expect(mocks.sendMemo).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "access-token",
        vehicleName: "쏘렌토",
        imageUrl: "https://cdn/img.png",
      })
    );
    expect(mocks.createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          savedQuoteId: "quote-1",
          imagePath: "sb-1/img.png",
          status: "PENDING",
        }),
      })
    );
    expect(mocks.updateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "delivery-1" },
        data: expect.objectContaining({ status: "SENT" }),
      })
    );
  });

  it("카카오 발송 실패는 502 + FAILED 기록(사유 포함)", async () => {
    mocks.sendMemo.mockResolvedValue({ ok: false, reason: "HTTP 403 insufficient scope" });

    const res = await POST(request());

    expect(res.status).toBe(502);
    expect(mocks.updateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          failReason: "HTTP 403 insufficient scope",
        }),
      })
    );
  });

  it("업로드 실패는 500 이고 이력을 만들지 않는다", async () => {
    mocks.upload.mockRejectedValue(new Error("bucket not found"));

    const res = await POST(request());

    expect(res.status).toBe(500);
    expect(mocks.createDelivery).not.toHaveBeenCalled();
    expect(mocks.sendMemo).not.toHaveBeenCalled();
  });
});
