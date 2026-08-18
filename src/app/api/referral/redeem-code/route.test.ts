import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  findUniqueUser: vi.fn(),
  applyReferralOnProfileComplete: vi.fn(),
}));

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUniqueUser },
  },
}));

vi.mock("@/lib/referral/apply", () => ({
  applyReferralOnProfileComplete: mocks.applyReferralOnProfileComplete,
}));

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

function request(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/referral/redeem-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function activeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    kakaoId: null,
    profileCompleted: true,
    profileCompletedAt: new Date(NOW - 2 * DAY),
    isActive: true,
    ...overrides,
  };
}

describe("POST /api/referral/redeem-code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveUser.mockResolvedValue({ user: activeUser(), error: null });
    mocks.findUniqueUser.mockResolvedValue({ id: "inviter-1", isActive: true });
    mocks.applyReferralOnProfileComplete.mockResolvedValue({
      applied: true,
      inviterUserId: "inviter-1",
      referralId: "ref-1",
    });
  });

  it("비로그인은 401", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 }),
    });
    const res = await POST(request({ code: "K4821" }));
    expect(res.status).toBe(401);
  });

  it("코드가 비어 있으면 400", async () => {
    const res = await POST(request({ code: "" }));
    expect(res.status).toBe(400);
    expect(mocks.applyReferralOnProfileComplete).not.toHaveBeenCalled();
  });

  it("간편가입 미완료 회원은 400", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: activeUser({ profileCompleted: false, profileCompletedAt: null }),
      error: null,
    });
    const res = await POST(request({ code: "K4821" }));
    expect(res.status).toBe(400);
    expect(mocks.applyReferralOnProfileComplete).not.toHaveBeenCalled();
  });

  it("가입 후 7일이 지나면 400", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: activeUser({ profileCompletedAt: new Date(NOW - 8 * DAY) }),
      error: null,
    });
    const res = await POST(request({ code: "K4821" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("기간");
    expect(mocks.applyReferralOnProfileComplete).not.toHaveBeenCalled();
  });

  it("형식이 잘못된 코드는 400", async () => {
    const res = await POST(request({ code: "AB123" }));
    expect(res.status).toBe(400);
    expect(mocks.findUniqueUser).not.toHaveBeenCalled();
  });

  it("존재하지 않는 코드는 400", async () => {
    mocks.findUniqueUser.mockResolvedValue(null);
    const res = await POST(request({ code: "K4821" }));
    expect(res.status).toBe(400);
    expect(mocks.applyReferralOnProfileComplete).not.toHaveBeenCalled();
  });

  it("본인 코드는 400", async () => {
    mocks.findUniqueUser.mockResolvedValue({ id: "user-1", isActive: true });
    const res = await POST(request({ code: "K4821" }));
    expect(res.status).toBe(400);
    expect(mocks.applyReferralOnProfileComplete).not.toHaveBeenCalled();
  });

  it("이미 추천이 적용된 계정은 409", async () => {
    mocks.applyReferralOnProfileComplete.mockResolvedValue({
      applied: false,
      reason: "ALREADY_ATTRIBUTED",
    });
    const res = await POST(request({ code: "K4821" }));
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("이미");
  });

  it("월 한도 등 기타 거절 사유는 일반 문구로 409", async () => {
    mocks.applyReferralOnProfileComplete.mockResolvedValue({
      applied: false,
      reason: "MONTHLY_CAP",
    });
    const res = await POST(request({ code: "K4821" }));
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).not.toContain("한도");
  });

  it("성공 시 창구 열림으로 apply 를 호출하고 200", async () => {
    const res = await POST(request({ code: "b7777" }));
    expect(res.status).toBe(200);
    expect(mocks.applyReferralOnProfileComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteeUserId: "user-1",
        rawCode: "B7777",
        isWithinEntryWindow: true,
      }),
      expect.anything(),
    );
  });
});
