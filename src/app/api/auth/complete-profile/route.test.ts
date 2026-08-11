import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  updateUser: vi.fn(),
  manualReferralClaim: vi.fn(),
  getClientIp: vi.fn(),
  hashIp: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: mocks.updateUser },
  },
}));

vi.mock("@/lib/referral/manual-claim", () => ({
  manualReferralClaim: mocks.manualReferralClaim,
}));

vi.mock("@/lib/ip-hash", () => ({
  getClientIp: mocks.getClientIp,
  hashIp: mocks.hashIp,
}));

function request(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/auth/complete-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/complete-profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.updateUser.mockResolvedValue({ id: "user-1" });
    mocks.getClientIp.mockReturnValue("1.2.3.4");
    mocks.hashIp.mockReturnValue("ip-hash");
    mocks.manualReferralClaim.mockResolvedValue({
      precheck: "ok",
      attribution: { status: "REWARDED", referralId: "ref-1" },
    });
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
  });

  it("marketingConsent 미지정 시 기본 false", async () => {
    await POST(request({ name: "홍길동", phone: "01012345678" }));
    expect(mocks.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ marketingConsent: false, profileCompleted: true }),
      })
    );
  });

  it("추천인 코드가 있으면 속성 로직을 호출하고 코드를 전달한다", async () => {
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "A1234" })
    );

    expect(res.status).toBe(200);
    expect(mocks.manualReferralClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        referralCode: "A1234",
        user: expect.objectContaining({ id: "user-1" }),
        ipHash: "ip-hash",
      })
    );
  });

  it("추천인 속성이 실패해도 프로필 완료는 그대로 성공이다", async () => {
    mocks.manualReferralClaim.mockRejectedValue(new Error("connection lost"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "A1234" })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ profileCompleted: true }) })
    );
    consoleError.mockRestore();
  });

  it("추천인 등록이 거부돼도 프로필 완료는 성공한다(비차단)", async () => {
    mocks.manualReferralClaim.mockResolvedValue({
      precheck: "rejected",
      rejection: "already_attributed",
    });

    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "A1234" })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("추천인 코드 미제출이면 속성 로직을 호출하지 않는다(no-op)", async () => {
    await POST(request({ name: "홍길동", phone: "010-1234-5678" }));

    expect(mocks.manualReferralClaim).not.toHaveBeenCalled();
  });

  it("속성 로그에는 PII 가 아닌 사유 코드만 남긴다", async () => {
    mocks.manualReferralClaim.mockResolvedValue({
      precheck: "ok",
      attribution: { status: "BLOCKED", reason: "self_referral" },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "A1234", marketingConsent: true })
    );

    const log = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(log).toContain("self_referral");
    expect(log).not.toContain("010-1234-5678");
    expect(log).not.toContain("1.2.3.4");
    warnSpy.mockRestore();
  });
});
