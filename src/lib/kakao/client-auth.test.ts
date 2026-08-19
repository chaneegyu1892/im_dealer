import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type OAuthStart = {
  readonly provider: string;
  readonly options?: { readonly redirectTo?: string };
};

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(async (_params: OAuthStart) => ({ error: null })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOAuth: mocks.signInWithOAuth },
  }),
}));

import { startKakaoLogin } from "./client-auth";

function lastRedirectTo(): string {
  const last = mocks.signInWithOAuth.mock.calls.at(-1)?.[0];
  expect(last).toBeDefined();
  return last?.options?.redirectTo ?? "";
}

describe("startKakaoLogin referral ref", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://imdealer.example");
    window.sessionStorage.clear();
    mocks.signInWithOAuth.mockClear();
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  it("forwards a valid ref onto the auth callback URL", async () => {
    await startKakaoLogin({ next: "/mypage/coupons", ref: "k4821" });

    const callback = new URL(lastRedirectTo());
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/mypage/coupons");
    expect(callback.searchParams.get("ref")).toBe("K4821");
  });

  it("forwards a previously persisted landing code when ref is omitted", async () => {
    window.sessionStorage.setItem("imdealer:pending-referral-code", "K4821");
    await startKakaoLogin({ next: "/mypage" });

    expect(new URL(lastRedirectTo()).searchParams.get("ref")).toBe("K4821");
  });

  it("does not attach an invalid ref to the callback", async () => {
    await startKakaoLogin({ next: "/mypage", ref: "nope" });

    expect(new URL(lastRedirectTo()).searchParams.get("ref")).toBeNull();
  });
});
