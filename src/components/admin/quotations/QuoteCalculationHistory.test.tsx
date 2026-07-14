import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuoteCalculationHistory } from "./QuoteCalculationHistory";

const calculation = {
  id: "calc-1",
  sessionId: "session-1",
  userId: "member-1",
  customerName: "카카오회원",
  phone: "010-1234-5678",
  userType: "Member" as const,
  vehicleId: "vehicle-1",
  vehicleSlug: "test-car",
  vehicleName: "테스트 차량",
  vehicleBrand: "테스트",
  trimId: "trim-1",
  trimName: "기본 트림",
  optionCount: 1,
  selectedOptions: [{ id: "option-1", name: "파노라마 선루프", price: 1_000_000 }],
  trimPrice: 40_000_000,
  discountPrice: 39_000_000,
  extraOptionsPrice: 0,
  optionsTotalPrice: 1_000_000,
  exteriorColorName: "화이트",
  interiorColorName: "블랙",
  colorDelta: 100_000,
  totalVehiclePrice: 40_100_000,
  contractMonths: 60,
  annualMileage: 20_000,
  depositRate: 10,
  prepayRate: 0,
  contractType: "반납형",
  productType: "장기렌트",
  customerType: "individual",
  resultMonthly: 650_000,
  bestFinanceCompany: "테스트캐피탈",
  scenarioType: "standard",
  pricingStatus: "CALCULATED" as const,
  clickedApply: false,
  deviceType: "mobile",
  createdAt: "2026-07-14T06:00:00.000Z",
  calculatedAt: "2026-07-14T07:00:00.000Z",
};

function success(total = 1) {
  return new Response(
    JSON.stringify({
      success: true,
      data: [calculation],
      meta: { total, page: 1, limit: 50 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

describe("QuoteCalculationHistory", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(() => Promise.resolve(success()));
  });

  it("shows result-only history with linked member and quote details", async () => {
    render(<QuoteCalculationHistory />);

    expect(await screen.findByText("테스트 차량")).toBeInTheDocument();
    expect(screen.getByText("카카오회원")).toBeInTheDocument();
    expect(screen.getByText("010-1234-5678")).toBeInTheDocument();
    expect(screen.getByText("테스트 · 기본 트림")).toBeInTheDocument();
    expect(screen.getByText("옵션 파노라마 선루프")).toBeInTheDocument();
    expect(screen.getByText("색상 화이트 / 블랙")).toBeInTheDocument();
    expect(screen.getByText("장기렌트 · 반납형 · 기본형")).toBeInTheDocument();
    expect(screen.getByText("보증금 10%")).toBeInTheDocument();
    expect(screen.getByText("차량가 40,100,000원")).toBeInTheDocument();
    expect(screen.getByText("650,000원")).toBeInTheDocument();
    expect(screen.getByText("상담·계약 신청 단계로 넘어간 견적은 제외됩니다.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/quote-calculations?page=1&limit=50"
    );
  });

  it("requests the next page without loading the full history at once", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(success(51)));
    render(<QuoteCalculationHistory />);

    await screen.findByText("테스트 차량");
    fireEvent.click(screen.getByRole("button", { name: "다음 페이지" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/quote-calculations?page=2&limit=50"
      )
    );
  });
});
