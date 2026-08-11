import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  transaction: vi.fn(),
  attributeReferral: vi.fn(),
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
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/kakao/account", () => ({
  fetchKakaoAccount: vi.fn(),
  fetchAgreedTermTags: vi.fn(),
}));

vi.mock("@/lib/kakao/channel", () => ({ getChannelRelation: vi.fn() }));
vi.mock("@/lib/kakao/scopes", () => ({ isKakaoSyncEnabled: () => false }));
vi.mock("@/lib/kakao/token", () => ({ storeKakaoRefreshToken: vi.fn() }));
vi.mock("@/lib/referral/attribute", () => ({ attributeReferral: mocks.attributeReferral }));

import { GET } from "./route";

const TX_CLIENT = { marker: "tx" };

const NEW_MEMBER = {
  id: "user-new",
  role: "member",
  profileCompleted: true,
  kakaoId: "kakao-new",
  phone: "010-9999-8888",
  email: "new@example.com",
  supabaseId: "supabase-new-member",
};

function callbackRequest(cookie?: string) {
  return new Request("https://app.example/auth/callback?code=code-1&next=/mypage", {
    headers: cookie ? { cookie } : undefined,
  });
}

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
    mocks.findUnique.mockResolvedValue({ id: "user-1", isActive: false });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(TX_CLIENT));
    mocks.attributeReferral.mockResolvedValue({ status: "REWARDED", referralId: "ref-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("revokes the newly exchanged session and returns an inactive account to login", async () => {
    const response = await GET(callbackRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/login?error=account_inactive");
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { supabaseId: "supabase-inactive-member" },
      select: { id: true, isActive: true },
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  describe("추천인 귀속", () => {
    beforeEach(() => {
      mocks.exchangeCodeForSession.mockResolvedValue({
        data: {
          user: {
            id: "supabase-new-member",
            email: "new@example.com",
            user_metadata: {},
            app_metadata: {},
            phone: null,
          },
          session: null,
        },
        error: null,
      });
      // upsert 이전 조회가 null → 이번 로그인이 신규 가입이라는 신호.
      mocks.findUnique.mockResolvedValue(null);
      mocks.upsert.mockResolvedValue(NEW_MEMBER);
    });

    it("신규 가입 + 유효 쿠키면 트랜잭션 안에서 귀속하고 쿠키를 비운다", async () => {
      const response = await GET(callbackRequest("imdealer_ref=A1234; other=1"));

      expect(mocks.transaction).toHaveBeenCalledTimes(1);
      expect(mocks.attributeReferral).toHaveBeenCalledWith({
        db: TX_CLIENT,
        refereeUser: NEW_MEMBER,
        referralCode: "A1234",
        ipHash: null,
      });
      expect(response.headers.get("location")).toBe("https://app.example/mypage");
      expect(response.headers.get("set-cookie")).toContain("imdealer_ref=;");
      expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    });

    it("x-forwarded-for 가 있으면 해시만 넘긴다 (원문 IP 미전달)", async () => {
      const request = new Request("https://app.example/auth/callback?code=code-1&next=/mypage", {
        headers: { cookie: "imdealer_ref=A1234", "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
      });

      await GET(request);

      const passed = mocks.attributeReferral.mock.calls[0][0];
      expect(passed.ipHash).toMatch(/^[0-9a-f]{16}$/);
      expect(passed.ipHash).not.toContain("203.0.113.9");
    });

    it("귀속이 throw 해도 로그인 리다이렉트는 그대로 나가고 쿠키는 지워진다", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.attributeReferral.mockRejectedValue(new Error("db down: new@example.com 010-9999-8888"));

      const response = await GET(callbackRequest("imdealer_ref=A1234"));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://app.example/mypage");
      expect(response.headers.get("set-cookie")).toContain("Max-Age=0");

      const logged = errorSpy.mock.calls.flat().map(String).join(" ");
      expect(logged).toBe("[auth/callback] referral attribution failed");
      expect(logged).not.toContain("new@example.com");
      expect(logged).not.toContain("010-9999-8888");
      errorSpy.mockRestore();
    });

    it("보상되지 않은 결과는 사유 코드만 남긴다", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocks.attributeReferral.mockResolvedValue({ status: "BLOCKED", reason: "self_referral" });

      await GET(callbackRequest("imdealer_ref=A1234"));

      const logged = warnSpy.mock.calls.flat().map(String).join(" ");
      expect(logged).toBe("[auth/callback] referral not rewarded: BLOCKED/self_referral");
      expect(logged).not.toContain("new@example.com");
      expect(logged).not.toContain("A1234");
      warnSpy.mockRestore();
    });

    it("쿠키가 없으면 귀속을 시도하지 않고 Set-Cookie 도 없다", async () => {
      const response = await GET(callbackRequest());

      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.attributeReferral).not.toHaveBeenCalled();
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("기존 회원 재로그인이면 쿠키가 있어도 귀속하지 않고 쿠키만 비운다", async () => {
      mocks.findUnique.mockResolvedValue({ id: "user-new", isActive: true });

      const response = await GET(callbackRequest("imdealer_ref=A1234"));

      expect(mocks.attributeReferral).not.toHaveBeenCalled();
      expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    });

    it("가입 미완료 회원은 /welcome 으로 가면서도 귀속·쿠키 정리를 마친다", async () => {
      mocks.upsert.mockResolvedValue({ ...NEW_MEMBER, profileCompleted: false });

      const response = await GET(callbackRequest("imdealer_ref=A1234"));

      expect(mocks.attributeReferral).toHaveBeenCalledTimes(1);
      expect(response.headers.get("location")).toBe(
        "https://app.example/welcome?next=%2Fmypage"
      );
      expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    });
  });
});
