import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateUser: vi.fn(),
  ensureUserReferralCode: vi.fn(),
  reconcileUserCoupons: vi.fn(),
  applyReferralOnProfileComplete: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: mocks.updateUser },
  },
}));

vi.mock("@/lib/referral/ensure-code", () => ({
  ensureUserReferralCode: mocks.ensureUserReferralCode,
}));

vi.mock("@/lib/coupons/reconcile", () => ({
  reconcileUserCoupons: mocks.reconcileUserCoupons,
}));

vi.mock("@/lib/referral/apply", () => ({
  applyReferralOnProfileComplete: mocks.applyReferralOnProfileComplete,
}));

function request(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new NextRequest("https://example.com/api/auth/complete-profile", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/complete-profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      profileCompleted: false,
      supabaseId: "sb-1",
      kakaoId: null,
    });
    mocks.updateUser.mockResolvedValue({ id: "user-1" });
    mocks.ensureUserReferralCode.mockResolvedValue("K4821");
    mocks.reconcileUserCoupons.mockResolvedValue(undefined);
    mocks.applyReferralOnProfileComplete.mockResolvedValue({ applied: false, reason: "INVALID_CODE" });
  });

  it("비로그인은 401", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const res = await POST(request({ name: "홍길동", phone: "010-1234-5678" }));
    expect(res.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("이름이 2자 미만이면 400", async () => {
    const res = await POST(request({ name: "김", phone: "010-1234-5678" }));
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("전화번호 형식이 잘못되면 400", async () => {
    const res = await POST(request({ name: "홍길동", phone: "02-123-4567" }));
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("정상 입력 시 전화번호를 국내 형식으로 정규화하고 profileCompleted=true 로 저장", async () => {
    const res = await POST(
      request({ name: "  홍길동  ", phone: "+82 10-1234-5678", marketingConsent: true })
    );
    expect(res.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        name: "홍길동",
        phone: "010-1234-5678",
        marketingConsent: true,
        profileCompleted: true,
      },
    });
    expect(mocks.ensureUserReferralCode).toHaveBeenCalledWith("user-1", expect.anything());
    expect(mocks.reconcileUserCoupons).toHaveBeenCalled();
  });

  it("marketingConsent 미지정 시 기본 false", async () => {
    await POST(request({ name: "홍길동", phone: "01012345678" }));
    expect(mocks.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ marketingConsent: false, profileCompleted: true }),
      })
    );
  });

  it("추천 쿠키가 있고 최초 가입 완료면 추천 인정을 시도한다", async () => {
    mocks.applyReferralOnProfileComplete.mockResolvedValue({
      applied: true,
      inviterUserId: "inviter-1",
    });
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678" }, "referral_code=K4821"),
    );
    expect(res.status).toBe(200);
    expect(mocks.applyReferralOnProfileComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteeUserId: "user-1",
        rawCode: "K4821",
        isFirstProfileComplete: true,
      }),
      expect.anything(),
    );
  });
});
