import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  allocateUniqueReferralCode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      signOut: mocks.signOut,
    },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

vi.mock("@/lib/kakao/account", () => ({
  fetchKakaoAccount: vi.fn(),
  fetchAgreedTermTags: vi.fn(),
}));

vi.mock("@/lib/kakao/channel", () => ({ getChannelRelation: vi.fn() }));
vi.mock("@/lib/kakao/scopes", () => ({ isKakaoSyncEnabled: () => false }));
vi.mock("@/lib/kakao/token", () => ({ storeKakaoRefreshToken: vi.fn() }));
vi.mock("@/lib/referral/ensure-code", () => ({
  allocateUniqueReferralCode: mocks.allocateUniqueReferralCode,
}));

import { GET } from "./route";

function authUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "supabase-member-1",
    email: "member@example.com",
    user_metadata: {},
    app_metadata: {},
    phone: null,
    ...overrides,
  };
}

function callbackRequest(query: string) {
  return new Request(`https://app.example/auth/callback${query}`);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: authUser(),
        session: null,
      },
      error: null,
    });
    mocks.findUnique.mockResolvedValue({ isActive: true });
    mocks.upsert.mockResolvedValue({ role: "member", profileCompleted: true });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.allocateUniqueReferralCode.mockResolvedValue("ABC12");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("completes a normal callback and keeps the exchanged session", async () => {
    const response = await GET(callbackRequest("?code=code-1&next=/mypage"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/mypage");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("code-1");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { supabaseId: "supabase-member-1" },
      select: { isActive: true },
    });
    expect(mocks.upsert).toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("keeps the session and returns a safe error when account status lookup fails", async () => {
    mocks.findUnique.mockRejectedValue(new Error("db connection refused"));

    const response = await GET(callbackRequest("?code=code-1&next=/mypage"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example/login?error=temporarily_unavailable",
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("revokes the newly exchanged session and returns an inactive account to login", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: authUser({ id: "supabase-inactive-member" }),
        session: null,
      },
      error: null,
    });
    mocks.findUnique.mockResolvedValue({ isActive: false });

    const response = await GET(callbackRequest("?code=code-1&next=/mypage"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/login?error=account_inactive");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { supabaseId: "supabase-inactive-member" },
      select: { isActive: true },
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects a callback without an authorization code", async () => {
    const response = await GET(callbackRequest("?next=/mypage"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/login?error=no_code");
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("does not sign out when session exchange fails for a stale code", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "invalid or expired code" },
    });

    const response = await GET(callbackRequest("?code=stale-code&next=/mypage"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/login?error=auth_failed");
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("does not treat a failed account lookup as a successful login", async () => {
    mocks.findUnique.mockRejectedValue(new Error("db connection refused"));

    const response = await GET(callbackRequest("?code=code-1&next=/mypage"));

    expect(response.headers.get("location")).not.toBe("https://app.example/mypage");
    expect(response.headers.get("location")).not.toBe("https://app.example/welcome?next=%2Fmypage");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("keeps the session when user upsert throws a non-Error value", async () => {
    mocks.upsert.mockRejectedValue("upsert exploded");

    const response = await GET(callbackRequest("?code=code-1&next=/mypage"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/mypage");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
