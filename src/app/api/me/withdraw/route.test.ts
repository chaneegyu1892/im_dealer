import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  getKakaoAccessToken: vi.fn(),
  unlinkKakaoAccount: vi.fn(),
  withdrawLocalMember: vi.fn(),
  recordOutcome: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/require-user", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/lib/kakao/token", () => ({ getKakaoAccessToken: mocks.getKakaoAccessToken }));
vi.mock("@/lib/kakao/account", () => ({ unlinkKakaoAccount: mocks.unlinkKakaoAccount }));
vi.mock("@/lib/account-withdrawal", () => ({
  withdrawLocalMember: mocks.withdrawLocalMember,
  recordSupabaseDeletionOutcome: mocks.recordOutcome,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signOut: mocks.signOut } })),
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: vi.fn(() => ({ auth: { admin: { deleteUser: mocks.deleteUser } } })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import { POST } from "./route";

const member = {
  id: "local-1",
  supabaseId: "supabase-1",
  role: "member",
  provider: "kakao",
  isActive: true,
};

function request(
  body: unknown = { confirmation: "회원탈퇴" },
  origin = "https://example.com"
): NextRequest {
  return new NextRequest("https://example.com/api/me/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("POST /api/me/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    mocks.requireActiveUser.mockResolvedValue({ user: member, error: null });
    mocks.getKakaoAccessToken.mockResolvedValue("kakao-access");
    mocks.unlinkKakaoAccount.mockResolvedValue(true);
    mocks.withdrawLocalMember.mockResolvedValue({
      auditLogId: "audit-1",
      deletedVerifications: 2,
      anonymizedQuotes: 3,
      unlinkedQuoteCalculations: 4,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.recordOutcome.mockResolvedValue(undefined);
  });

  it("blocks unauthenticated and inactive callers before any deletion", async () => {
    for (const status of [401, 403]) {
      mocks.requireActiveUser.mockResolvedValueOnce({
        user: null,
        error: new Response(null, { status }),
      });
      const response = await POST(request());
      expect(response.status).toBe(status);
    }

    expect(mocks.withdrawLocalMember).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests and requires an explicit confirmation phrase", async () => {
    expect(await POST(request(undefined, "https://attacker.example"))).toMatchObject({
      status: 403,
    });
    expect(await POST(request({ confirmation: "yes" }))).toMatchObject({ status: 400 });
    expect(mocks.withdrawLocalMember).not.toHaveBeenCalled();
  });

  it("withdraws only the authenticated member and attempts all provider cleanup", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.getKakaoAccessToken).toHaveBeenCalledWith("supabase-1");
    expect(mocks.unlinkKakaoAccount).toHaveBeenCalledWith("kakao-access");
    expect(mocks.withdrawLocalMember).toHaveBeenCalledWith(member, true);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.deleteUser).toHaveBeenCalledWith("supabase-1");
    expect(mocks.recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ auditLogId: "audit-1" }),
      true,
      true
    );
  });

  it("completes local withdrawal and surfaces cleanup state when Kakao or Supabase rejects cleanup", async () => {
    mocks.unlinkKakaoAccount.mockResolvedValue(false);
    mocks.signOut.mockResolvedValue({ error: new Error("signout unavailable") });
    mocks.deleteUser.mockResolvedValue({ error: new Error("delete unavailable") });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      cleanup: {
        kakaoUnlinked: false,
        sessionsRevoked: false,
        supabaseAuthDeleted: false,
      },
    });
    expect(mocks.withdrawLocalMember).toHaveBeenCalledWith(member, false);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
