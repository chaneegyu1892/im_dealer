import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  getKakaoAccessToken: vi.fn(),
  unlinkKakaoAccount: vi.fn(),
  hasKakaoUnlinked: vi.fn(),
  markKakaoUnlinked: vi.fn(),
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
  hasKakaoUnlinkedForWithdrawal: mocks.hasKakaoUnlinked,
  markKakaoUnlinkedForWithdrawal: mocks.markKakaoUnlinked,
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
    mocks.hasKakaoUnlinked.mockResolvedValue(false);
    mocks.markKakaoUnlinked.mockResolvedValue(undefined);
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
    expect(mocks.markKakaoUnlinked).toHaveBeenCalledWith("local-1");
    expect(mocks.withdrawLocalMember).toHaveBeenCalledWith(member, true);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.deleteUser).toHaveBeenCalledWith("supabase-1");
    expect(mocks.recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ auditLogId: "audit-1" }),
      true,
      true,
      "supabase-1"
    );
  });

  it("keeps local data and stops provider cleanup when Kakao unlink fails", async () => {
    mocks.unlinkKakaoAccount.mockResolvedValue(false);

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload).toEqual({
      error: "카카오 계정 연결 해제에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    });
    expect(mocks.markKakaoUnlinked).not.toHaveBeenCalled();
    expect(mocks.withdrawLocalMember).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.recordOutcome).not.toHaveBeenCalled();
  });

  it("keeps local data when Kakao access token cannot be issued", async () => {
    mocks.getKakaoAccessToken.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(422);
    expect(mocks.unlinkKakaoAccount).not.toHaveBeenCalled();
    expect(mocks.withdrawLocalMember).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("resumes local destruction when a previous attempt already unlinked Kakao", async () => {
    mocks.hasKakaoUnlinked.mockResolvedValue(true);
    mocks.getKakaoAccessToken.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.unlinkKakaoAccount).not.toHaveBeenCalled();
    expect(mocks.markKakaoUnlinked).not.toHaveBeenCalled();
    expect(mocks.withdrawLocalMember).toHaveBeenCalledWith(member, true);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.deleteUser).toHaveBeenCalledWith("supabase-1");
  });

  it("lets the user retry after a Kakao outage without destroying local data on the failed attempt", async () => {
    mocks.unlinkKakaoAccount.mockResolvedValue(false);

    const first = await POST(request());
    expect(first.status).toBe(422);
    expect(mocks.withdrawLocalMember).not.toHaveBeenCalled();

    mocks.unlinkKakaoAccount.mockResolvedValue(true);

    const retry = await POST(request());
    expect(retry.status).toBe(200);
    expect(mocks.withdrawLocalMember).toHaveBeenCalledTimes(1);
    expect(mocks.withdrawLocalMember).toHaveBeenCalledWith(member, true);
  });

  it("keeps the Kakao-unlinked marker so a later retry can finish after local destruction fails", async () => {
    mocks.withdrawLocalMember.mockRejectedValue(new Error("local destroy failed"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(mocks.markKakaoUnlinked).toHaveBeenCalledWith("local-1");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("continues local destruction when Kakao unlink succeeded but the unlink marker write fails", async () => {
    mocks.markKakaoUnlinked.mockRejectedValue(new Error("audit write failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.unlinkKakaoAccount).toHaveBeenCalledWith("kakao-access");
    expect(mocks.withdrawLocalMember).toHaveBeenCalledWith(member, true);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.deleteUser).toHaveBeenCalledWith("supabase-1");
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ operation: "account-withdrawal-kakao-marker" }),
      })
    );
    expect(warn).toHaveBeenCalledWith(
      "[withdraw] kakao unlink marker write failed",
      { memberId: "local-1" }
    );
    warn.mockRestore();
  });
});
