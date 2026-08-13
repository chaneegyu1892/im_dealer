import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  findSavedQuote: vi.fn(),
  buildOfficialImageData: vi.fn(),
  createDelivery: vi.fn(),
  updateDelivery: vi.fn(),
  render: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  getAccessToken: vi.fn(),
  sendMemo: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: { findFirst: mocks.findSavedQuote },
    quoteDelivery: { create: mocks.createDelivery, update: mocks.updateDelivery },
  },
}));

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

vi.mock("@/lib/quote-image/render-quote-image", () => ({
  renderQuoteImageBuffer: mocks.render,
}));

vi.mock("@/lib/quote-delivery/official-image", () => ({
  buildOfficialDeliveryImageData: mocks.buildOfficialImageData,
}));

vi.mock("@/lib/quote-delivery/store", () => ({
  uploadQuoteImage: mocks.upload,
  deleteQuoteImage: mocks.remove,
}));
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
        scenarios: {
          conservative: quoteScenario(560_000, 8_000_000, 0),
          standard: quoteScenario(500_000, 0, 0),
          aggressive: quoteScenario(430_000, 0, 12_000_000),
        },
        savedQuoteId: "quote-1",
        sessionId: "session-1",
      }
    ),
  });
}

function quoteScenario(
  monthlyPayment: number,
  depositAmount: number,
  prepayAmount: number
): Record<string, unknown> {
  return {
    monthlyPayment,
    depositAmount,
    prepayAmount,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
    bestFinanceCompany: "테스트금융",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
  };
}

const officialImageData = {
  vehicleName: "서버 쏘렌토",
  vehicleBrand: "서버 기아",
  trimName: "서버 트림",
  trimPrice: 42_000_000,
  selectedOptions: [],
  totalVehiclePrice: 42_000_000,
  productType: "장기렌트",
  contractMonths: 48,
  annualMileage: 20_000,
  contractType: "반납형",
  scenarioType: "standard" as const,
  scenarios: {
    conservative: quoteScenario(560_000, 8_000_000, 0),
    standard: quoteScenario(500_000, 0, 0),
    aggressive: quoteScenario(430_000, 0, 12_000_000),
  },
  userEmail: null,
  exteriorColor: null,
  interiorColor: null,
};

const savedQuote = {
  id: "quote-1",
  vehicleId: "vehicle-1",
  trimId: "trim-1",
  contractMonths: 48,
  annualMileage: 20_000,
  depositRate: 0,
  prepayRate: 0,
  contractType: "반납형",
  monthlyPayment: 500_000,
  pricingStatus: "CALCULATED",
  breakdown: {},
  exteriorColorId: null,
  interiorColorId: null,
};

describe("POST /api/quote/deliver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "true");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://imdealer.example");
    mocks.requireActiveUser.mockResolvedValue({
      user: { id: "user-1", supabaseId: "sb-1", email: "a@b.com" },
      error: null,
    });
    mocks.findSavedQuote.mockResolvedValue(savedQuote);
    mocks.buildOfficialImageData.mockResolvedValue({ ok: true, data: officialImageData });
    mocks.getAccessToken.mockResolvedValue("access-token");
    mocks.render.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.upload.mockResolvedValue({ path: "deliveries/img.png" });
    mocks.remove.mockResolvedValue(undefined);
    mocks.createDelivery.mockResolvedValue({ id: "delivery-1" });
    mocks.updateDelivery.mockResolvedValue({});
    mocks.sendMemo.mockResolvedValue({ ok: true, reason: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("기능 플래그가 꺼져 있으면 전송 API도 비활성화한다", async () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "false");

    const res = await POST(request());

    expect(res.status).toBe(404);
    expect(mocks.requireActiveUser).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("비로그인은 401", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 }),
    });
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("필수 견적 정보가 없으면 400", async () => {
    const res = await POST(request({ vehicleName: "쏘렌토" }));
    expect(res.status).toBe(400);
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("현재 회원이 저장한 견적과 세션이 아니면 403", async () => {
    mocks.findSavedQuote.mockResolvedValue(null);

    const res = await POST(request());

    expect(res.status).toBe(403);
    expect(mocks.findSavedQuote).toHaveBeenCalledWith({
      where: {
        id: "quote-1",
        sessionId: "session-1",
        userId: "sb-1",
        deletedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      select: {
        id: true,
        vehicleId: true,
        trimId: true,
        contractMonths: true,
        annualMileage: true,
        depositRate: true,
        prepayRate: true,
        contractType: true,
        monthlyPayment: true,
        pricingStatus: true,
        breakdown: true,
        exteriorColorId: true,
        interiorColorId: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("토큰 재발급 실패는 409 + 재로그인 코드, 렌더링은 시작조차 안 한다", async () => {
    mocks.getAccessToken.mockResolvedValue(null);
    const res = await POST(request());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "KAKAO_REAUTH_REQUIRED" });
    expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("성공하면 업로드한 이미지를 보존 기간 동안 유지하며 발송하고 SENT 로 기록한다", async () => {
    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { deliveryId: "delivery-1" } });

    expect(mocks.upload).toHaveBeenCalledWith({ png: expect.any(Uint8Array) });
    expect(mocks.sendMemo).toHaveBeenCalledWith(
      {
        accessToken: "access-token",
        linkUrl: "https://imdealer.example/quote/delivery/delivery-1",
      }
    );
    expect(mocks.render).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleName: "서버 쏘렌토", userEmail: null })
    );
    expect(mocks.createDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          savedQuoteId: "quote-1",
          imagePath: "deliveries/img.png",
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
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("ignores tampered client financial fields and renders only the server-built quote", async () => {
    const res = await POST(request({
      savedQuoteId: "quote-1",
      sessionId: "session-1",
      vehicleName: "위조 차량",
      totalVehiclePrice: 1,
      scenarios: {
        conservative: quoteScenario(1, 0, 0),
        standard: quoteScenario(1, 0, 0),
        aggressive: quoteScenario(1, 0, 0),
      },
    }));

    expect(res.status).toBe(200);
    expect(mocks.buildOfficialImageData).toHaveBeenCalledWith(savedQuote);
    expect(mocks.render).toHaveBeenCalledWith(officialImageData);
  });

  it("카카오 발송 실패는 502 + FAILED 기록(사유 포함)", async () => {
    mocks.sendMemo.mockResolvedValue({ ok: false, reason: "HTTP 403 insufficient scope" });

    const res = await POST(request());

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: "카카오톡 전송에 실패했습니다. 다시 시도하거나 상담하기를 이용해 주세요.",
    });
    expect(mocks.updateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          failReason: "HTTP 403 insufficient scope",
        }),
      })
    );
    expect(mocks.remove).toHaveBeenCalledWith("deliveries/img.png");
  });

  it("업로드 후 이력 생성이 실패하면 공개 이미지를 삭제한다", async () => {
    mocks.createDelivery.mockRejectedValue(new Error("database unavailable"));

    const res = await POST(request());

    expect(res.status).toBe(500);
    expect(mocks.remove).toHaveBeenCalledWith("deliveries/img.png");
    expect(mocks.sendMemo).not.toHaveBeenCalled();
  });

  it("업로드 실패는 500 이고 이력을 만들지 않는다", async () => {
    mocks.upload.mockRejectedValue(new Error("bucket not found"));

    const res = await POST(request());

    expect(res.status).toBe(500);
    expect(mocks.createDelivery).not.toHaveBeenCalled();
    expect(mocks.sendMemo).not.toHaveBeenCalled();
  });

  it("카카오 이미지 제한인 5MB를 넘으면 업로드하지 않는다", async () => {
    mocks.render.mockResolvedValue(new Uint8Array(5 * 1024 * 1024 + 1));

    const res = await POST(request());

    expect(res.status).toBe(413);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.createDelivery).not.toHaveBeenCalled();
    expect(mocks.sendMemo).not.toHaveBeenCalled();
  });
});
