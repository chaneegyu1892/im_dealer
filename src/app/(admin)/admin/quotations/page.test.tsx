import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminSavedQuote } from "@/types/admin";
import QuotationsPage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@/lib/activity-store", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/components/admin/VerificationResult", () => ({
  VerificationResult: () => null,
}));

vi.mock("@/components/admin/quotations/ReviewLinkSection", () => ({
  ReviewLinkSection: () => null,
}));

function quote(overrides: Partial<AdminSavedQuote> = {}): AdminSavedQuote {
  return {
    id: "quote-none",
    sessionId: "session-1",
    userId: "member-1",
    customerName: "카카오회원",
    phone: "010-1234-5678",
    vehicleId: "vehicle-1",
    vehicleName: "테스트 차량",
    vehicleBrand: "테스트",
    trimId: "trim-1",
    trimName: "기본 트림",
    trimPrice: 50_000_000,
    discountPrice: 45_000_000,
    contractMonths: 60,
    annualMileage: 20_000,
    depositRate: 0,
    prepayRate: 0,
    contractType: "반납형",
    customerType: "individual",
    productType: "장기렌트",
    monthlyPayment: 650_000,
    totalCost: 39_000_000,
    pricingStatus: "CALCULATED",
    status: "NEW",
    internalMemo: null,
    userType: "Member",
    quoteType: "DETAIL",
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
    exteriorColorName: null,
    exteriorColorHex: null,
    interiorColorName: null,
    interiorColorHex: null,
    selectedOptions: [],
    delivery: {
      status: "NONE",
      failReason: null,
      createdAt: null,
      sentAt: null,
    },
    alimtalk: null,
    ...overrides,
  };
}

function ok(data: AdminSavedQuote[]) {
  return new Response(
    JSON.stringify({ success: true, data, meta: { total: data.length, page: 1, limit: 100 } }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

describe("QuotationsPage delivery status column", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders delivery badges and does not label a quote without history as 미전달", async () => {
    fetchMock.mockResolvedValue(
      ok([
        quote({
          id: "quote-sent",
          vehicleName: "전달된 차량",
          delivery: {
            status: "SENT",
            failReason: null,
            createdAt: "2026-08-19T09:00:00.000Z",
            sentAt: "2026-08-19T09:01:00.000Z",
          },
        }),
        quote({
          id: "quote-pending",
          vehicleName: "전달중 차량",
          delivery: {
            status: "PENDING",
            failReason: null,
            createdAt: "2026-08-19T09:10:00.000Z",
            sentAt: null,
          },
        }),
        quote({
          id: "quote-failed",
          vehicleName: "실패 차량",
          delivery: {
            status: "FAILED",
            failReason: "카카오톡 미가입",
            createdAt: "2026-08-19T09:20:00.000Z",
            sentAt: null,
          },
        }),
        quote({
          id: "quote-none",
          vehicleName: "이력없는 차량",
        }),
      ])
    );

    render(<QuotationsPage />);

    expect(await screen.findByRole("columnheader", { name: "전달" })).toBeInTheDocument();
    expect(screen.getByText("전달됨")).toBeInTheDocument();
    expect(screen.getByText("전달중")).toBeInTheDocument();
    expect(screen.getByText("실패")).toBeInTheDocument();
    expect(screen.getByText("이력없음")).toBeInTheDocument();
    expect(screen.queryByText("미전달")).not.toBeInTheDocument();
  });

  it("shows fail reason in the drawer detail, not only the list badge", async () => {
    fetchMock.mockResolvedValue(
      ok([
        quote({
          id: "quote-failed",
          vehicleName: "실패 차량",
          delivery: {
            status: "FAILED",
            failReason: "카카오톡 미가입",
            createdAt: "2026-08-19T09:20:00.000Z",
            sentAt: null,
          },
          alimtalk: {
            status: "FAILED",
            failReason: "3019 톡 유저 아님",
            resultCode: "3019",
            templateKey: "QUOTE_DELIVERED",
            createdAt: "2026-08-19T09:05:00.000Z",
            resultAt: "2026-08-19T09:06:00.000Z",
          },
        }),
      ])
    );

    render(<QuotationsPage />);

    fireEvent.click(await screen.findByText("실패 차량"));

    await waitFor(() => {
      expect(screen.getByText("카카오톡 미가입")).toBeInTheDocument();
      expect(screen.getByText("3019 톡 유저 아님")).toBeInTheDocument();
    });
  });
});
