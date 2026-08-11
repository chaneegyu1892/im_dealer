import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  fetch: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

import { QuoteCard } from "./QuoteCard";
import type { MyPageQuote } from "@/lib/member-queries/mypage";

function buildQuote(overrides: Partial<MyPageQuote> = {}): MyPageQuote {
  return {
    id: "quote-1",
    sessionId: "session-1",
    vehicleSlug: "test-car",
    vehicleName: "테스트 차량",
    vehicleBrand: "테스트",
    thumbnailUrl: null,
    trimId: "trim-1",
    trimName: "기본 트림",
    selectedOptionIds: [],
    selectedOptions: [],
    exteriorColor: null,
    interiorColor: null,
    totalVehiclePrice: null,
    productType: "장기렌트",
    contractType: "반납형",
    customerType: "individual",
    contractMonths: 36,
    annualMileage: 20000,
    depositRate: 10,
    prepayRate: 0,
    monthlyPayment: 450000,
    pricingStatus: "CALCULATED",
    status: "NEW",
    statusInfo: {
      label: "견적 접수",
      description: "선택한 조건을 확인하고 상담을 이어갈 수 있어요.",
      tone: "info",
      progressIndex: 0,
    },
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    expiresAt: new Date("2026-12-01T00:00:00Z"),
    delivery: null,
    ...overrides,
  };
}

describe("QuoteCard 삭제 버튼", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.fetch.mockReset();
    mocks.confirm.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
    vi.stubGlobal("confirm", mocks.confirm);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('"견적 삭제" aria-label 을 가진 X 버튼이 렌더된다', () => {
    render(<QuoteCard quote={buildQuote()} />);
    expect(screen.getByRole("button", { name: "견적 삭제" })).toBeInTheDocument();
  });

  it("확인 후 DELETE 요청을 보내고 카드가 사라진다", async () => {
    mocks.confirm.mockReturnValue(true);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    render(<QuoteCard quote={buildQuote()} />);
    fireEvent.click(screen.getByRole("button", { name: "견적 삭제" }));

    expect(mocks.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith("/api/quote/quote-1", { method: "DELETE" });
    });
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "견적 삭제" })).not.toBeInTheDocument();
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("확인을 취소하면 요청을 보내지 않는다", () => {
    mocks.confirm.mockReturnValue(false);

    render(<QuoteCard quote={buildQuote()} />);
    fireEvent.click(screen.getByRole("button", { name: "견적 삭제" }));

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "견적 삭제" })).toBeInTheDocument();
  });
});
