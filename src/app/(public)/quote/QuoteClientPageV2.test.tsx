import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteClientPageV2 } from "./QuoteClientPageV2";
import {
  createFetchMock,
  vehicles,
  writeCalculatedRestore,
  writeConsultationRestore,
} from "./QuoteClientPageV2.test-fixtures";

const navigationMock = vi.hoisted(() => ({
  router: {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  },
  searchParams: new URLSearchParams("vehicle=preparing-car&customerType=individual&restore=1"),
}));

const supabaseMock = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: null } })),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationMock.router,
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: supabaseMock.getUser,
      onAuthStateChange: supabaseMock.onAuthStateChange,
    },
  }),
}));

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  delete window.ChannelIO;
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  navigationMock.searchParams = new URLSearchParams("vehicle=preparing-car&customerType=individual&restore=1");
  navigationMock.router.back.mockReset();
  navigationMock.router.push.mockReset();
  navigationMock.router.replace.mockReset();
});

describe("QuoteClientPageV2 consultation fallback", () => {
  it("keeps the quote result summary and shows consultation guidance when scenarios are missing", async () => {
    writeConsultationRestore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true, data: [] }))
    );

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    await screen.findByText("이 차량은 별도 상담이 필요합니다");

    expect(screen.getByText("준비중 차량")).toBeInTheDocument();
    expect(screen.getByText("프리미엄")).toBeInTheDocument();
    expect(screen.getByText("상품")).toBeInTheDocument();
    expect(screen.getByText("장기렌트")).toBeInTheDocument();
    expect(screen.getByText("계약기간")).toBeInTheDocument();
    expect(screen.getByText("60개월")).toBeInTheDocument();
    expect(screen.getByText("약정거리")).toBeInTheDocument();
    expect(screen.getByText("연 2만km")).toBeInTheDocument();
    expect(screen.getByText("월 납입금")).toBeInTheDocument();
    expect(screen.getByText("별도 상담 필요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택 조건으로 상담 요청하기" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("문제가 발생했습니다")).not.toBeInTheDocument();
    });
  });

  it("continues to consultation result when the selected vehicle has no trims", async () => {
    navigationMock.searchParams = new URLSearchParams("vehicle=preparing-car&customerType=individual");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.endsWith("/colors")) {
          return Response.json({ success: true, data: [] });
        }
        if (url.endsWith("/trims")) {
          return Response.json({ success: true, data: [] });
        }
        if (url.endsWith("/quote")) {
          return Response.json({
            success: true,
            data: {
              vehicleSlug: "preparing-car",
              trimId: "",
              trimName: "",
              trimPrice: 40_000_000,
              optionsTotalPrice: 0,
              colorDelta: 0,
              totalVehiclePrice: 40_000_000,
              contractMonths: 60,
              annualMileage: 20000,
              contractType: "반납형",
              customerType: "individual",
              scenarios: {},
              requiresConsultation: true,
            },
          });
        }
        return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
      })
    );

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    const submit = await screen.findByRole("button", { name: "상담 필요 견적 확인하기" });
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    await screen.findByText("이 차량은 별도 상담이 필요합니다");
    expect(screen.getByText("준비중 차량")).toBeInTheDocument();
    expect(screen.getByText("월 납입금")).toBeInTheDocument();
    expect(screen.getByText("별도 상담 필요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "선택 조건으로 상담 요청하기" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("트림을 선택하세요")).not.toBeInTheDocument();
    });
  });

  it("persists the calculated quote before routing to verification", async () => {
    writeCalculatedRestore();
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    const apply = await screen.findByRole("button", { name: "이 조건으로 심사 요청하기" });
    fireEvent.click(apply);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/quote/save",
        expect.objectContaining({ method: "POST" })
      );
    });
    const saveCall = fetchMock.mock.calls.find(([input]) => input.toString() === "/api/quote/save");
    expect(String(saveCall?.[1]?.body)).toContain('"customDepositRate":10');
    expect(String(saveCall?.[1]?.body)).toContain('"quoteType":"DETAIL"');
    const draftKey = Object.keys(window.localStorage).find((key) => key.startsWith("quote_draft_"));
    expect(window.localStorage.getItem(draftKey ?? "")).toContain(
      '"customRates":{"depositRate":10,"prepayRate":0}'
    );
    expect(navigationMock.router.push).toHaveBeenCalledWith(
      expect.stringContaining("/login?next=")
    );
  });

  it("shows an inline error and stays on the quote when persistence fails", async () => {
    writeCalculatedRestore();
    vi.stubGlobal("fetch", createFetchMock(500));

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    fireEvent.click(await screen.findByRole("button", { name: "이 조건으로 심사 요청하기" }));

    const message = await screen.findByText(
      "견적 저장에 실패했습니다. 잠시 후 다시 시도해주세요."
    );
    await waitFor(() => expect(message).toBeVisible());
    expect(navigationMock.router.push).not.toHaveBeenCalled();
  });

  it("keeps the AI source through the member-gate login round trip", async () => {
    navigationMock.searchParams = new URLSearchParams(
      "vehicle=preparing-car&customerType=individual&restore=1&source=AI"
    );
    writeCalculatedRestore();
    vi.stubGlobal("fetch", createFetchMock());

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    fireEvent.click(await screen.findByRole("button", {
      name: "월 납입금을 낮추고 싶으시다면 로그인 해주세요",
    }));

    expect(navigationMock.router.push).toHaveBeenCalledWith(
      expect.stringContaining("source%3DAI")
    );
  });

  it("prefills the exact AI-recommended trim and quote contract", async () => {
    navigationMock.searchParams = new URLSearchParams(
      "vehicle=preparing-car&customerType=individual&source=AI&trim=trim-ai&productType=장기렌트&contractMonths=60&annualMileage=20000"
    );
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = input.toString();
      if (url.endsWith("/colors")) {
        return Response.json({ success: true, data: [] });
      }
      if (url.endsWith("/trims")) {
        return Response.json({
          success: true,
          data: [
            {
              id: "trim-default",
              name: "기본 트림",
              price: 38_000_000,
              discountPrice: null,
              evSubsidy: null,
              engineType: "GASOLINE",
              fuelEfficiency: 10,
              isDefault: true,
              specs: null,
              options: [],
              rules: [],
              lineupId: null,
              lineup: null,
              availableProducts: ["장기렌트"],
            },
            {
              id: "trim-ai",
              name: "AI 추천 트림",
              price: 40_000_000,
              discountPrice: 39_000_000,
              evSubsidy: null,
              engineType: "HEV",
              fuelEfficiency: 16,
              isDefault: false,
              specs: null,
              options: [],
              rules: [],
              lineupId: null,
              lineup: null,
              availableProducts: [],
            },
          ],
        });
      }
      if (url.endsWith("/quote")) {
        return Response.json({ success: false, error: "request captured" }, { status: 400 });
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    fireEvent.click(await screen.findByRole("button", { name: "선택 조건 확인하기" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([request]) => request.toString().endsWith("/quote"))).toBe(true);
    });
    const quoteCall = fetchMock.mock.calls.find(([request]) => request.toString().endsWith("/quote"));
    expect(JSON.parse(String(quoteCall?.[1]?.body))).toMatchObject({
      trimId: "trim-ai",
      productType: "장기렌트",
      contractMonths: 60,
      annualMileage: 20_000,
      contractType: "반납형",
    });
  });

  it("saves consultation conditions before opening ChannelTalk with the quote id", async () => {
    writeConsultationRestore();
    const channelCalls: unknown[][] = [];
    window.ChannelIO = (...args: unknown[]) => channelCalls.push(args);
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = input.toString();
      if (url.endsWith("/colors") || url.endsWith("/trims")) {
        return Response.json({ success: true, data: [] });
      }
      if (url === "/api/quote/save") {
        return Response.json({
          success: true,
          data: {
            id: "consultation-quote-1",
            sessionId: "consultation-session-1",
            requiresConsultation: true,
          },
        });
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    fireEvent.click(await screen.findByRole("button", {
      name: "선택 조건으로 상담 요청하기",
    }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/quote/save",
        expect.objectContaining({ method: "POST" })
      );
    });
    const saveCall = fetchMock.mock.calls.find(([input]) => input.toString() === "/api/quote/save");
    expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({
      trimId: "trim-preparing",
      productType: "장기렌트",
      contractMonths: 60,
      annualMileage: 20_000,
    });
    expect(channelCalls).toEqual([
      ["track", "quote_consultation_requested", expect.objectContaining({
        quoteId: "consultation-quote-1",
        sessionId: "consultation-session-1",
        trimName: "프리미엄",
      })],
      ["showMessenger"],
    ]);
  });
});
