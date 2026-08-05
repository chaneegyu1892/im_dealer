import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoleAtLeast: vi.fn(),
  findSavedQuote: vi.fn(),
  buildOfficialDeliveryImageData: vi.fn(),
  renderQuoteImageBuffer: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireRoleAtLeast,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: { findFirst: mocks.findSavedQuote },
  },
}));

vi.mock("@/lib/quote-delivery/official-image", () => ({
  buildOfficialDeliveryImageData: mocks.buildOfficialDeliveryImageData,
}));

vi.mock("@/lib/quote-image/render-quote-image", () => ({
  renderQuoteImageBuffer: mocks.renderQuoteImageBuffer,
}));

import { GET } from "./route";

const savedQuote = {
  id: "quote-123456",
  vehicleId: "vehicle-1",
  trimId: "trim-1",
  contractMonths: 60,
  annualMileage: 20_000,
  depositRate: 0,
  prepayRate: 0,
  contractType: "반납형",
  monthlyPayment: 812_725,
  pricingStatus: "CALCULATED",
  breakdown: { scenarioType: "standard", productType: "장기렌트" },
  exteriorColorId: null,
  interiorColorId: null,
  customerName: "김진규",
  phone: "010-9366-2054",
};

const officialImageData = {
  vehicleName: "New Model Y",
  vehicleBrand: "테슬라",
  trimName: "Premium RWD",
  trimPrice: 49_990_000,
  selectedOptions: [],
  totalVehiclePrice: 51_276_000,
  productType: "장기렌트",
  contractMonths: 60,
  annualMileage: 20_000,
  contractType: "반납형",
  scenarioType: "standard",
  scenarios: {},
  userEmail: null,
  exteriorColor: null,
  interiorColor: null,
};

function get(): Promise<Response> {
  return GET(new NextRequest("https://example.com/api/admin/quotes/quote-123456/image"), {
    params: Promise.resolve({ id: savedQuote.id }),
  });
}

describe("GET /api/admin/quotes/[id]/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRoleAtLeast.mockResolvedValue({
      admin: { id: "admin-1", email: "admin@imdealer.kr" },
    });
    mocks.findSavedQuote.mockResolvedValue(savedQuote);
    mocks.buildOfficialDeliveryImageData.mockResolvedValue({
      ok: true,
      data: officialImageData,
    });
    mocks.renderQuoteImageBuffer.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("reissues through the shared official builder with an admin re-issue label", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    // 카카오 전송 견적서와 같은 빌더를 써야 저장값(월 납입금·비교 시나리오)이 유지된다.
    expect(mocks.buildOfficialDeliveryImageData).toHaveBeenCalledWith(savedQuote);
    expect(mocks.renderQuoteImageBuffer).toHaveBeenCalledWith({
      ...officialImageData,
      userEmail: "김진규 / 010-9366-2054 (어드민 재발급: admin@imdealer.kr)",
    });
  });

  it("rejects consultation-only quotes before building an image", async () => {
    mocks.findSavedQuote.mockResolvedValue({
      ...savedQuote,
      pricingStatus: "CONSULTATION_REQUIRED",
    });

    const response = await get();

    expect(response.status).toBe(409);
    expect(mocks.buildOfficialDeliveryImageData).not.toHaveBeenCalled();
  });

  it("forwards builder failures with their status", async () => {
    mocks.buildOfficialDeliveryImageData.mockResolvedValue({
      ok: false,
      error: { status: 409, error: "저장된 견적을 현재 공식 견적서로 재구성할 수 없습니다." },
    });

    const response = await get();
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("저장된 견적을 현재 공식 견적서로 재구성할 수 없습니다.");
    expect(mocks.renderQuoteImageBuffer).not.toHaveBeenCalled();
  });
});
