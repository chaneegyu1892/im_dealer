import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteClientPageV2 } from "./QuoteClientPageV2";
import {
  createUnlockedCalculatedQuoteResult,
  createFetchMock,
  vehicles,
  writeCalculatedRestore,
  writeConsultationRestore,
  writeLockedCalculatedRestore,
} from "./QuoteClientPageV2.test-fixtures";

type MockAuthUser = {
  readonly id: string;
} | null;

const navigationMock = vi.hoisted(() => ({
  router: {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  },
  searchParams: new URLSearchParams("vehicle=preparing-car&customerType=individual&restore=1"),
}));

const supabaseMock = vi.hoisted(() => ({
  getUser: vi.fn<
    () => Promise<{ readonly data: { readonly user: MockAuthUser } }>
  >(async () => ({ data: { user: null } })),
  signInWithOAuth: vi.fn<
    (params: {
      readonly provider: string;
      readonly options?: { readonly redirectTo?: string };
    }) => Promise<{
      readonly data: { readonly provider: string; readonly url: string | null };
      readonly error: null;
    }>
  >(async () => ({ data: { provider: "kakao", url: null }, error: null })),
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
      signInWithOAuth: supabaseMock.signInWithOAuth,
      onAuthStateChange: supabaseMock.onAuthStateChange,
    },
  }),
}));

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "true");
  // 자동발송(나에게 보내기) 테스트용 — 기본 흐름은 채널추가 수동 발송이므로 명시적으로 켠다.
  vi.stubEnv("NEXT_PUBLIC_KAKAO_QUOTE_AUTO_SEND", "true");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://imdealer.example");
  supabaseMock.getUser.mockReset();
  supabaseMock.getUser.mockResolvedValue({ data: { user: null } });
  supabaseMock.signInWithOAuth.mockReset();
  supabaseMock.signInWithOAuth.mockResolvedValue({
    data: { provider: "kakao", url: null },
    error: null,
  });
});

afterEach(() => {
  delete window.ChannelIO;
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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

    const apply = await screen.findByRole("button", { name: "심사 요청하기" });
    fireEvent.click(apply);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/quote/save",
        expect.objectContaining({ method: "POST" })
      );
    });
    const saveCall = fetchMock.mock.calls.find(([input]) => input.toString() === "/api/quote/save");
    expect(String(saveCall?.[1]?.body)).toContain('"scenarioType":"conservative"');
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

  it("keeps the range warning readable on narrow Korean layouts", async () => {
    writeCalculatedRestore();
    const storedRestore = window.localStorage.getItem("quote_image_restore");
    if (!storedRestore) throw new Error("quote restore fixture is missing");
    const restore = JSON.parse(storedRestore) as {
      quoteResult: {
        scenarios: {
          standard: {
            rangeExceeded?: boolean;
          };
        };
      };
    };
    restore.quoteResult.scenarios.standard.rangeExceeded = true;
    window.localStorage.setItem("quote_image_restore", JSON.stringify(restore));
    vi.stubGlobal("fetch", createFetchMock());

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    const warning = await screen.findByText(/선택하신 옵션 조합으로 차량가가/);
    expect(warning).toHaveClass("break-keep");
  });

  it("starts Kakao consent from the successful-result delivery action", async () => {
    // Given: a calculated quote has been restored and normal render fetches are available
    writeCalculatedRestore();
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    // When: the customer opens the send action
    render(<QuoteClientPageV2 vehicles={vehicles} />);
    const deliveryButton = await screen.findByRole("button", {
      name: "카카오톡으로 견적서 받기",
    });
    expect(screen.getByRole("button", { name: "심사 요청하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상담하기" })).toBeInTheDocument();
    fireEvent.click(deliveryButton);

    // Then: anonymous users enter Kakao consent before any delivery request
    await waitFor(() => expect(supabaseMock.signInWithOAuth).toHaveBeenCalledTimes(1));
    const requestedUrls = fetchMock.mock.calls.map(([input]) => input.toString());
    expect(requestedUrls.some((url) => url === "/api/quote/image")).toBe(false);
    expect(requestedUrls.some((url) => url === "/api/quote/deliver")).toBe(false);
  });

  it("saves the exact quote before delivering its server-side identifier to Kakao", async () => {
    writeCalculatedRestore();
    supabaseMock.getUser.mockResolvedValue({
      data: { user: { id: "supabase-user-1" } },
    });
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
          data: { id: "saved-quote-1", sessionId: "saved-session-1" },
        });
      }
      if (url === "/api/quote/deliver") {
        return Response.json({
          success: true,
          data: { deliveryId: "delivery-1" },
        });
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);
    fireEvent.click(await screen.findByRole("button", { name: "카카오톡으로 견적서 받기" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/quote/deliver",
        expect.objectContaining({ method: "POST" })
      );
    });

    const saveIndex = fetchMock.mock.calls.findIndex(([input]) => input.toString() === "/api/quote/save");
    const deliverIndex = fetchMock.mock.calls.findIndex(([input]) => input.toString() === "/api/quote/deliver");
    expect(saveIndex).toBeGreaterThanOrEqual(0);
    expect(deliverIndex).toBeGreaterThan(saveIndex);

    const deliverCall = fetchMock.mock.calls[deliverIndex];
    expect(JSON.parse(String(deliverCall?.[1]?.body))).toEqual({
      savedQuoteId: "saved-quote-1",
      sessionId: "saved-session-1",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "카카오톡으로 견적서를 보냈어요"
    );
  });

  it("refreshes a restored anonymous quote before saving and delivering its server-side identifier", async () => {
    writeLockedCalculatedRestore();
    supabaseMock.getUser.mockResolvedValue({
      data: { user: { id: "supabase-user-1" } },
    });
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = input.toString();
      if (url.endsWith("/colors") || url.endsWith("/trims")) {
        return Response.json({ success: true, data: [] });
      }
      if (url.endsWith("/quote")) {
        return Response.json({
          success: true,
          data: createUnlockedCalculatedQuoteResult(),
        });
      }
      if (url === "/api/quote/save") {
        return Response.json({
          success: true,
          data: { id: "saved-quote-1", sessionId: "saved-session-1" },
        });
      }
      if (url === "/api/quote/deliver") {
        return Response.json({
          success: true,
          data: { deliveryId: "delivery-1" },
        });
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);
    fireEvent.click(await screen.findByRole("button", { name: "카카오톡으로 견적서 받기" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/quote/deliver",
        expect.objectContaining({ method: "POST" })
      );
    });

    const quoteIndex = fetchMock.mock.calls.findIndex(
      ([input]) => input.toString() === "/api/vehicles/preparing-car/quote"
    );
    const saveIndex = fetchMock.mock.calls.findIndex(
      ([input]) => input.toString() === "/api/quote/save"
    );
    const deliverIndex = fetchMock.mock.calls.findIndex(
      ([input]) => input.toString() === "/api/quote/deliver"
    );
    expect(quoteIndex).toBeGreaterThanOrEqual(0);
    expect(saveIndex).toBeGreaterThan(quoteIndex);
    expect(deliverIndex).toBeGreaterThan(saveIndex);

    const deliverBody = JSON.parse(
      String(fetchMock.mock.calls[deliverIndex]?.[1]?.body)
    );
    expect(deliverBody).toEqual({
      savedQuoteId: "saved-quote-1",
      sessionId: "saved-session-1",
    });
  });

  it("requests Kakao consent directly when the stored provider token must be renewed", async () => {
    writeCalculatedRestore();
    supabaseMock.getUser.mockResolvedValue({
      data: { user: { id: "supabase-user-1" } },
    });
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
          data: { id: "saved-quote-1", sessionId: "saved-session-1" },
        });
      }
      if (url === "/api/quote/deliver") {
        return Response.json(
          {
            error: "카카오톡 전송 권한이 만료되었습니다.",
            code: "KAKAO_REAUTH_REQUIRED",
          },
          { status: 409 }
        );
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);
    fireEvent.click(await screen.findByRole("button", { name: "카카오톡으로 견적서 받기" }));

    await waitFor(() => expect(supabaseMock.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(supabaseMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: expect.objectContaining({
        scopes: expect.stringContaining("talk_message"),
        queryParams: {
          scope: expect.stringContaining("talk_message"),
        },
      }),
    });
    expect(navigationMock.router.push).not.toHaveBeenCalledWith(
      expect.stringContaining("/login?next=")
    );
  });

  it("routes quote delivery to Kakao channel add when the Kakao flag is disabled (stopgap)", async () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "false");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID", "_TestCh");
    // 견적서 수령은 회원 전용 — 채널톡 경로도 로그인 세션이 있어야 진행된다.
    supabaseMock.getUser.mockResolvedValue({
      data: { user: { id: "supabase-user-1" } },
    });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeCalculatedRestore();
    const channelCalls: unknown[][] = [];
    window.ChannelIO = (...args: unknown[]) => {
      channelCalls.push(args);
    };
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
          data: { id: "saved-quote-1", sessionId: "saved-session-1" },
        });
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "카카오톡으로 견적서 받기" })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/quote/save",
        expect.objectContaining({ method: "POST" })
      );
    });

    // 임시방편: 자동발송(/api/quote/deliver) 대신 안내 모달 → 카카오 채널 대화창으로 유도한다.
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/quote/deliver",
      expect.anything()
    );
    // ① 상담사가 볼 견적 컨텍스트를 채널톡 track 으로 기록
    const trackCall = channelCalls.find(
      (args) => args[0] === "track" && args[1] === "quote_delivery_requested"
    );
    expect(trackCall).toBeDefined();
    // ② 견적 요청 메시지를 클립보드에 복사(붙여넣기 유도)
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("[견적서 요청]"))
    );
    // ③ 바로 이동하지 않고 안내 모달을 띄운다 — 복사 안내를 읽은 뒤 CTA 로 이동.
    const dialog = await screen.findByRole("dialog", {
      name: "견적 요청 메시지를 복사했어요",
    });
    expect(dialog).toHaveTextContent("길게 눌러 붙여넣기");
    expect(openSpy).not.toHaveBeenCalled();

    // ④ 모달 CTA 클릭 → 채널 홈이 아니라 채널 "대화창"(/chat)을 연다.
    //    (클릭 직후 동기 실행 — 팝업 차단 회피를 위해 한 번의 창 열기만 수행)
    fireEvent.click(screen.getByRole("button", { name: "견적서 받으러 가기" }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "https://pf.kakao.com/_TestCh/chat",
      "_blank",
      "noopener,noreferrer"
    );
    // CTA 클릭 시 새 제스처에서 한 번 더 복사한다(첫 복사의 활성화 만료 대비).
    expect(writeText).toHaveBeenCalledTimes(2);
    // 모달이 닫히고 완료 안내가 남는다.
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "견적 요청 메시지를 복사했어요" })
      ).not.toBeInTheDocument()
    );
    // 붙여넣기 전에는 상담사에게 가지 않았으므로 완료가 아니라 미전송 안내가 남는다.
    expect(screen.getByRole("status")).toHaveTextContent("아직 보내지 않았어요");

    // ⑤ 창을 닫았거나 붙여넣기를 놓쳤을 때 대화창으로 되돌아갈 길을 남긴다.
    fireEvent.click(screen.getByRole("button", { name: "대화창 다시 열기" }));
    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenLastCalledWith(
      "https://pf.kakao.com/_TestCh/chat",
      "_blank",
      "noopener,noreferrer"
    );
    // 다시 열 때도 요청 문구를 새로 복사해 준다.
    expect(writeText).toHaveBeenCalledTimes(3);

    // ⑥ 실제로 보낸 고객은 '보냈어요'로 경고를 닫을 수 있다.
    fireEvent.click(screen.getByRole("button", { name: "보냈어요" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("상담사가 확인 후")
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("아직 보내지 않았어요");
    // 상담사 데스크에도 고객이 전송했다고 남긴다.
    expect(
      channelCalls.find(
        (args) => args[0] === "track" && args[1] === "quote_delivery_sent"
      )
    ).toBeDefined();
  });

  it("gates the channel-talk quote delivery behind login when signed out", async () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "false");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID", "_TestCh");
    supabaseMock.getUser.mockResolvedValue({ data: { user: null } });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeCalculatedRestore();
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async (input) => {
      const url = input.toString();
      if (url.endsWith("/colors") || url.endsWith("/trims")) {
        return Response.json({ success: true, data: [] });
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "카카오톡으로 견적서 받기" })
    );

    // 로그인 안내 모달만 뜨고, 견적 저장·복사·대화창은 모두 보류된다.
    await screen.findByRole("dialog", { name: "로그인이 필요해요" });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/quote/save", expect.anything());
    expect(writeText).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "견적 요청 메시지를 복사했어요" })
    ).not.toBeInTheDocument();
  });

  it("starts Kakao login with a delivery resume marker from the login gate", async () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "false");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID", "_TestCh");
    supabaseMock.getUser.mockResolvedValue({ data: { user: null } });
    writeCalculatedRestore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true, data: [] }))
    );

    render(<QuoteClientPageV2 vehicles={vehicles} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "카카오톡으로 견적서 받기" })
    );
    await screen.findByRole("dialog", { name: "로그인이 필요해요" });
    fireEvent.click(screen.getByRole("button", { name: "카카오 로그인" }));

    await waitFor(() => expect(supabaseMock.signInWithOAuth).toHaveBeenCalled());
    const redirectTo = supabaseMock.signInWithOAuth.mock.calls.at(-1)?.[0]?.options
      ?.redirectTo as string;
    // 로그인 후 돌아와 견적 요청을 이어가도록 복귀 주소에 표식을 남긴다.
    const next = decodeURIComponent(new URL(redirectTo).searchParams.get("next") ?? "");
    expect(next).toContain("/quote");
    expect(next).toContain("deliver=1");
    expect(next).toContain("restore=1");
  });

  it("resumes the delivery guide after returning from login and never auto-opens the chat", async () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "false");
    vi.stubEnv("NEXT_PUBLIC_KAKAO_CHANNEL_PUBLIC_ID", "_TestCh");
    navigationMock.searchParams = new URLSearchParams(
      "vehicle=preparing-car&customerType=individual&restore=1&deliver=1"
    );
    supabaseMock.getUser.mockResolvedValue({
      data: { user: { id: "supabase-user-1" } },
    });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeCalculatedRestore();
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
          data: { id: "saved-quote-1", sessionId: "saved-session-1" },
        });
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    // 버튼을 다시 누르지 않아도 안내 모달까지 자동으로 이어진다.
    await screen.findByRole("dialog", { name: "견적 요청 메시지를 복사했어요" });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/quote/save",
        expect.objectContaining({ method: "POST" })
      )
    );
    // 팝업 차단 때문에 대화창은 CTA 클릭으로만 연다.
    expect(openSpy).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "로그인이 필요해요" })
    ).not.toBeInTheDocument();
  });

  it("shows an inline error and stays on the quote when persistence fails", async () => {
    writeCalculatedRestore();
    vi.stubGlobal("fetch", createFetchMock(500));

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    fireEvent.click(await screen.findByRole("button", { name: "심사 요청하기" }));

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
