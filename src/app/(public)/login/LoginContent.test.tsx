import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginContent from "./LoginContent";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  getSession: vi.fn(async () => ({
    data: { session: null as { user: { id: string } } | null },
  })),
  signInWithOAuth: vi.fn(async () => ({
    data: { provider: "kakao", url: null },
    error: null,
  })),
}));

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams("next=%2Fquote%3Fvehicle%3Dsonata"),
}));

const ORIGINAL_UA = window.navigator.userAgent;

const KAKAO_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK/10.5.0";
const CHROME_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: mocks.getSession,
      signInWithOAuth: mocks.signInWithOAuth,
    },
  }),
}));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "true");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://imdealer.example");
  mocks.replace.mockReset();
  mocks.getSession.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.signInWithOAuth.mockReset();
  mocks.signInWithOAuth.mockResolvedValue({
    data: { provider: "kakao", url: null },
    error: null,
  });
  navigation.searchParams = new URLSearchParams(
    "next=%2Fquote%3Fvehicle%3Dsonata"
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  setUserAgent(ORIGINAL_UA);
  window.sessionStorage.clear();
});

describe("LoginContent Kakao OAuth", () => {
  it("requests the talk_message scope when Kakao quote delivery is enabled", async () => {
    render(<LoginContent />);

    fireEvent.click(await screen.findByRole("button", { name: "카카오 로그인" }));

    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: {
        redirectTo:
          "https://imdealer.example/auth/callback?next=%2Fquote%3Fvehicle%3Dsonata",
        scopes:
          "profile_nickname,profile_image,account_email,name,phone_number,talk_message,plusfriends",
        queryParams: {
          scope:
            "profile_nickname,profile_image,account_email,name,phone_number,talk_message,plusfriends",
        },
      },
    });
  });

  it("does not pass an external next URL into the OAuth callback", async () => {
    navigation.searchParams = new URLSearchParams(
      "next=https%3A%2F%2Fevil.example%2Fquote"
    );
    render(<LoginContent />);

    fireEvent.click(await screen.findByRole("button", { name: "카카오 로그인" }));

    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: expect.objectContaining({
        redirectTo: "https://imdealer.example/auth/callback?next=%2F",
      }),
    });
  });

  it("does not navigate an existing session to an encoded protocol-relative next path", async () => {
    navigation.searchParams = new URLSearchParams(
      "next=%2F%252e%252e%2F%2Fevil.example%2Fphish"
    );
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "member-1" } } },
    });

    render(<LoginContent />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));
  });
});

describe("LoginContent KakaoTalk in-app auto login", () => {
  it("starts Kakao login automatically inside the KakaoTalk in-app browser", async () => {
    setUserAgent(KAKAO_ANDROID_UA);

    render(<LoginContent />);

    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    // 루프 방지 플래그가 실제로 기록됐는지 확인한다. 이 assertion 이 없으면
    // 플래그를 기록하는 줄이 삭제돼도 이 테스트는 계속 통과한다.
    expect(
      window.sessionStorage.getItem("imdealer:inapp-auto-login-attempted")
    ).toBe("1");
  });

  it("does not start Kakao login when unmounted before getSession resolves", async () => {
    setUserAgent(KAKAO_ANDROID_UA);
    let resolveGetSession: (value: {
      data: { session: null };
    }) => void = () => {};
    mocks.getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetSession = resolve;
        })
    );

    const { unmount } = render(<LoginContent />);
    unmount();

    resolveGetSession({ data: { session: null } });
    // getSession() 의 then 콜백이 실행될 마이크로태스크 틱을 흘려보낸다.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("does not auto start in an ordinary browser", async () => {
    setUserAgent(CHROME_ANDROID_UA);

    render(<LoginContent />);

    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("does not auto start when a session already exists", async () => {
    setUserAgent(KAKAO_ANDROID_UA);
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "member-1" } } },
    });

    render(<LoginContent />);

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/quote?vehicle=sonata")
    );
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("does not auto start after a failed callback redirect", async () => {
    setUserAgent(KAKAO_ANDROID_UA);
    navigation.searchParams = new URLSearchParams(
      "next=%2Fmypage&error=auth_failed"
    );

    render(<LoginContent />);

    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("does not auto start twice in the same tab", async () => {
    setUserAgent(KAKAO_ANDROID_UA);
    window.sessionStorage.setItem("imdealer:inapp-auto-login-attempted", "1");

    render(<LoginContent />);

    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });
});

describe("LoginContent external browser escape link", () => {
  it("offers an escape link inside the KakaoTalk in-app browser", async () => {
    setUserAgent(KAKAO_ANDROID_UA);
    // 자동 로그인이 이미 시도된 상태로 만들어 수동 화면을 렌더링시킨다.
    window.sessionStorage.setItem("imdealer:inapp-auto-login-attempted", "1");

    render(<LoginContent />);

    const link = await screen.findByRole("link", {
      name: "다른 브라우저에서 열기",
    });
    expect(link).toHaveAttribute("href", expect.stringContaining("intent://"));
  });

  it("hides the escape link in an ordinary browser", async () => {
    setUserAgent(CHROME_ANDROID_UA);

    render(<LoginContent />);

    await waitFor(() => expect(mocks.getSession).toHaveBeenCalled());
    expect(
      screen.queryByRole("link", { name: "다른 브라우저에서 열기" })
    ).toBeNull();
  });
});
