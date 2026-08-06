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
  });

  it("does not auto start in an ordinary browser", async () => {
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
