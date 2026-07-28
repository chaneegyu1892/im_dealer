import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
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

import { GET } from "./route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "supabase-inactive-member",
          email: "member@example.com",
          user_metadata: {},
          app_metadata: {},
          phone: null,
        },
        session: null,
      },
      error: null,
    });
    mocks.findUnique.mockResolvedValue({ isActive: false });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("revokes the newly exchanged session and returns an inactive account to login", async () => {
    const response = await GET(new Request("https://app.example/auth/callback?code=code-1&next=/mypage"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/login?error=account_inactive");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { supabaseId: "supabase-inactive-member" },
      select: { isActive: true },
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
