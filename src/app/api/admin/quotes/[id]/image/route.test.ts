import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  findQuote: vi.fn(),
  findVehicle: vi.fn(),
  requireAdmin: vi.fn(),
  buildScenarios: vi.fn(),
  renderImage: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: { findFirst: mocks.findQuote },
    vehicle: { findUnique: mocks.findVehicle },
  },
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireAdmin,
}));

vi.mock("@/lib/quote-scenarios", () => ({
  buildVehicleScenarios: mocks.buildScenarios,
}));

vi.mock("@/lib/quote-image/render-quote-image", () => ({
  renderQuoteImageBuffer: mocks.renderImage,
}));

function scenario(monthlyPayment: number) {
  return {
    monthlyPayment,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
    bestFinanceCompany: "테스트캐피탈",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
  };
}

const savedQuote = {
  id: "quote-123456",
  vehicleId: "vehicle-1",
  trimId: "trim-1",
  contractMonths: 48,
  annualMileage: 20_000,
  contractType: "반납형",
  pricingStatus: "CALCULATED",
  breakdown: { scenarioType: "aggressive", productType: "장기렌트" },
  exteriorColorId: null,
  interiorColorId: null,
  customerName: "고객",
  phone: "010-0000-0000",
};

describe("GET /api/admin/quotes/[id]/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ admin: { id: "admin-1", email: "admin@example.com" } });
    mocks.findQuote.mockResolvedValue(savedQuote);
    mocks.findVehicle.mockResolvedValue({ slug: "test-car" });
    mocks.buildScenarios.mockResolvedValue({
      ok: true,
      data: {
        vehicleName: "테스트 차량",
        vehicleBrand: "테스트",
        trimName: "테스트 트림",
        trimPrice: 40_000_000,
        selectedOptions: [],
        totalVehiclePrice: 40_000_000,
        scenarios: {
          conservative: scenario(610_000),
          standard: scenario(700_000),
          aggressive: scenario(530_000),
        },
        exteriorColor: null,
        interiorColor: null,
      },
    });
    mocks.renderImage.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("passes a valid saved scenario selection to image rendering", async () => {
    // Given: a saved quote breakdown contains a valid aggressive selection
    const request = new NextRequest("https://example.com/api/admin/quotes/quote-123456/image");

    // When: an admin regenerates the quote image
    const response = await GET(request, { params: Promise.resolve({ id: savedQuote.id }) });

    // Then: the renderer receives the saved semantic selection
    expect(response.status).toBe(200);
    expect(mocks.renderImage).toHaveBeenCalledWith(
      expect.objectContaining({ scenarioType: "aggressive" })
    );
  });

  it("uses legacy PDF selection when the saved scenario is invalid", async () => {
    // Given: a legacy breakdown contains an unsupported scenario value
    mocks.findQuote.mockResolvedValue({
      ...savedQuote,
      breakdown: { scenarioType: "experimental", productType: "장기렌트" },
    });
    const request = new NextRequest("https://example.com/api/admin/quotes/quote-123456/image");

    // When: an admin regenerates the quote image
    const response = await GET(request, { params: Promise.resolve({ id: savedQuote.id }) });

    // Then: the PDF renderer receives the legacy fallback signal
    expect(response.status).toBe(200);
    expect(mocks.renderImage).toHaveBeenCalledWith(
      expect.objectContaining({ scenarioType: undefined })
    );
  });
});
