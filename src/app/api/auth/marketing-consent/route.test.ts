import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  userUpdate: vi.fn(),
  getKakaoAccessToken: vi.fn(),
  revokeKakaoServiceTerms: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: mocks.userUpdate } },
}));
vi.mock("@/lib/require-user", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/lib/kakao/token", () => ({ getKakaoAccessToken: mocks.getKakaoAccessToken }));
vi.mock("@/lib/kakao/account", () => ({ revokeKakaoServiceTerms: mocks.revokeKakaoServiceTerms }));

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/marketing-consent", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function kakaoUser(overrides: Record<string, unknown> = {}) {
  return { id: "u1", supabaseId: "sb-1", provider: "kakao", isActive: true, ...overrides };
}

function authenticate(user = kakaoUser()) {
  mocks.requireActiveUser.mockResolvedValue({ user, error: null });
}

describe("PATCH /api/auth/marketing-consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdate.mockResolvedValue({});
    mocks.getKakaoAccessToken.mockResolvedValue("access-token");
    mocks.revokeKakaoServiceTerms.mockResolvedValue(true);
  });

  it("비로그인은 401", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 }),
    });
    const res = await PATCH(req({ consent: false }));
    expect(res.status).toBe(401);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("비활성화된 계정은 403", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "비활성화된 계정입니다." }), { status: 403 }),
    });
    const res = await PATCH(req({ consent: false }));
    expect(res.status).toBe(403);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("잘못된 요청 형식은 400", async () => {
    authenticate();
    const res = await PATCH(req({ consent: "yes" }));
    expect(res.status).toBe(400);
  });

  it("동의(true)는 DB만 갱신하고 카카오 철회는 호출하지 않는다", async () => {
    authenticate();
    const res = await PATCH(req({ consent: true }));
    expect(res.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { marketingConsent: true },
    });
    expect(mocks.revokeKakaoServiceTerms).not.toHaveBeenCalled();
  });

  it("철회(false)는 DB 갱신 후 카카오 약관도 best-effort 철회한다", async () => {
    authenticate();
    const res = await PATCH(req({ consent: false }));
    expect(res.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { marketingConsent: false },
    });
    expect(mocks.getKakaoAccessToken).toHaveBeenCalledWith("sb-1");
    expect(mocks.revokeKakaoServiceTerms).toHaveBeenCalledWith("access-token", ["marketing"]);
  });

  it("카카오가 아닌 사용자는 철회여도 카카오 API를 호출하지 않는다", async () => {
    authenticate(kakaoUser({ provider: "email" }));
    const res = await PATCH(req({ consent: false }));
    expect(res.status).toBe(200);
    expect(mocks.getKakaoAccessToken).not.toHaveBeenCalled();
  });
});
