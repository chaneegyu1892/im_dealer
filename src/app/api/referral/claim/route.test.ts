import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  manualReferralClaim: vi.fn(),
  getClientIp: vi.fn(),
  hashIp: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/referral/manual-claim", () => ({
  manualReferralClaim: mocks.manualReferralClaim,
}));

vi.mock("@/lib/ip-hash", () => ({
  getClientIp: mocks.getClientIp,
  hashIp: mocks.hashIp,
}));

function request(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/referral/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function attribution(status: string, reason?: string) {
  return { precheck: "ok", attribution: { status, reason } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
  mocks.getClientIp.mockReturnValue("1.2.3.4");
  mocks.hashIp.mockReturnValue("ip-hash");
  mocks.manualReferralClaim.mockResolvedValue(
    attribution("REWARDED", undefined)
  );
});

describe("POST /api/referral/claim", () => {
  it("비로그인은 401", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const res = await POST(request({ referralCode: "A1234" }));

    expect(res.status).toBe(401);
    expect(mocks.manualReferralClaim).not.toHaveBeenCalled();
  });

  it("유효 코드면 등록 로직을 호출하고 200", async () => {
    const res = await POST(request({ referralCode: "A1234" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.manualReferralClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        referralCode: "A1234",
        user: expect.objectContaining({ id: "user-1" }),
        ipHash: "ip-hash",
      })
    );
  });

  it("이미 귀속된 회원이면 409", async () => {
    mocks.manualReferralClaim.mockResolvedValue({
      precheck: "rejected",
      rejection: "already_attributed",
    });

    const res = await POST(request({ referralCode: "A1234" }));

    expect(res.status).toBe(409);
  });

  it("가입 7일이 지나면 400", async () => {
    mocks.manualReferralClaim.mockResolvedValue({
      precheck: "rejected",
      rejection: "expired",
    });

    const res = await POST(request({ referralCode: "A1234" }));

    expect(res.status).toBe(400);
  });

  it("자기 추천 코드는 400 + 안내 문구", async () => {
    mocks.manualReferralClaim.mockResolvedValue(
      attribution("BLOCKED", "self_referral")
    );

    const res = await POST(request({ referralCode: "A1234" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("본인 추천 코드");
  });

  it("알 수 없는 코드(SKIPPED)는 400", async () => {
    mocks.manualReferralClaim.mockResolvedValue(
      attribution("SKIPPED", "referrer_not_found")
    );

    const res = await POST(request({ referralCode: "A1234" }));

    expect(res.status).toBe(400);
  });

  it("등록 장애는 500 으로 처리하고 죽지 않는다", async () => {
    mocks.manualReferralClaim.mockRejectedValue(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(request({ referralCode: "A1234" }));

    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });
});
