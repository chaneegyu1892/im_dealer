import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginContent from "./LoginContent";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  getSession: vi.fn(async () => ({ data: { session: null } })),
  signInWithOAuth: vi.fn(async () => ({
    data: { provider: "kakao", url: null },
    error: null,
  })),
}));

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams("next=%2Fquote%3Fvehicle%3Dsonata"),
}));

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
});

describe("LoginContent Kakao OAuth", () => {
  it("requests the talk_message scope when Kakao quote delivery is enabled", async () => {
    render(<LoginContent />);

    fireEvent.click(await screen.findByRole("button", { name: "카카오로 시작하기" }));

    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: {
        redirectTo:
          "https://imdealer.example/auth/callback?next=%2Fquote%3Fvehicle%3Dsonata",
        scopes:
          "profile_nickname,profile_image,account_email,name,phone_number,talk_message",
        queryParams: {
          scope:
            "profile_nickname,profile_image,account_email,name,phone_number,talk_message",
        },
      },
    });
  });

  it("does not pass an external next URL into the OAuth callback", async () => {
    navigation.searchParams = new URLSearchParams(
      "next=https%3A%2F%2Fevil.example%2Fquote"
    );
    render(<LoginContent />);

    fireEvent.click(await screen.findByRole("button", { name: "카카오로 시작하기" }));

    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: expect.objectContaining({
        redirectTo: "https://imdealer.example/auth/callback?next=%2F",
      }),
    });
  });
});
