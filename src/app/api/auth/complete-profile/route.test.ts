import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashIp } from "@/lib/ip-hash";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  updateUser: vi.fn(),
  findUniqueUser: vi.fn(),
  transaction: vi.fn(),
  ensureUserReferralCode: vi.fn(),
  reconcileUserCoupons: vi.fn(),
  applyReferralOnProfileComplete: vi.fn(),
}));

/** $transaction 콜백에 넘어가는 tx 클라이언트 표식 */
const TX = { __tx: true };

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: mocks.updateUser, findUnique: mocks.findUniqueUser },
    $transaction: mocks.transaction,
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

function request(
  body: unknown,
  cookie?: string,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
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
    mocks.requireActiveUser.mockResolvedValue({
      user: {
        id: "user-1",
        profileCompleted: false,
        supabaseId: "sb-1",
        kakaoId: null,
        isActive: true,
      },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ id: "user-1" });
    mocks.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(TX));
    mocks.ensureUserReferralCode.mockResolvedValue("K4821");
    mocks.reconcileUserCoupons.mockResolvedValue(undefined);
    mocks.applyReferralOnProfileComplete.mockResolvedValue({ applied: false, reason: "INVALID_CODE" });
  });

  it("비로그인은 401", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 }),
    });
    const res = await POST(request({ name: "홍길동", phone: "010-1234-5678" }));
    expect(res.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("비활성화된 계정은 403", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "비활성화된 계정입니다." }), { status: 403 }),
    });
    const res = await POST(request({ name: "홍길동", phone: "010-1234-5678" }));
    expect(res.status).toBe(403);
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
        profileCompletedAt: expect.any(Date),
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
        isWithinEntryWindow: true,
      }),
      expect.anything(),
    );
  });

  it("직접 입력한 추천인 코드 형식이 잘못되면 400이고 프로필을 저장하지 않는다", async () => {
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "ABC12" }),
    );
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("존재하지 않는 추천인 코드를 입력하면 400", async () => {
    mocks.findUniqueUser.mockResolvedValue(null);
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "K4821" }),
    );
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("비활성 추천인의 코드를 입력하면 400", async () => {
    mocks.findUniqueUser.mockResolvedValue({ id: "inviter-1", isActive: false });
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "K4821" }),
    );
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("본인의 추천 코드를 입력하면 400", async () => {
    mocks.findUniqueUser.mockResolvedValue({ id: "user-1", isActive: true });
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "K4821" }),
    );
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("직접 입력한 코드는 소문자여도 정규화되고 쿠키보다 우선한다", async () => {
    mocks.findUniqueUser.mockResolvedValue({ id: "inviter-2", isActive: true });
    mocks.applyReferralOnProfileComplete.mockResolvedValue({
      applied: true,
      inviterUserId: "inviter-2",
    });
    const res = await POST(
      request(
        { name: "홍길동", phone: "010-1234-5678", referralCode: "b7777" },
        "referral_code=K4821",
      ),
    );
    expect(res.status).toBe(200);
    expect(mocks.applyReferralOnProfileComplete).toHaveBeenCalledWith(
      expect.objectContaining({ rawCode: "B7777", isWithinEntryWindow: true }),
      expect.anything(),
    );
  });

  it("빈 문자열 추천인 코드는 없는 것으로 취급한다", async () => {
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "" }),
    );
    expect(res.status).toBe(200);
    expect(mocks.findUniqueUser).not.toHaveBeenCalled();
    expect(mocks.applyReferralOnProfileComplete).not.toHaveBeenCalled();
  });

  it("가입 IP 해시를 추천 인정에 전달한다", async () => {
    await POST(
      request({ name: "홍길동", phone: "010-1234-5678" }, "referral_code=K4821", {
        "x-forwarded-for": "1.2.3.4, 10.0.0.1",
      }),
    );
    expect(mocks.applyReferralOnProfileComplete).toHaveBeenCalledWith(
      expect.objectContaining({ signupIpHash: hashIp("1.2.3.4") }),
      expect.anything(),
    );
  });

  it("IP 를 알 수 없으면 signupIpHash 는 null 이다", async () => {
    await POST(request({ name: "홍길동", phone: "010-1234-5678" }, "referral_code=K4821"));
    expect(mocks.applyReferralOnProfileComplete).toHaveBeenCalledWith(
      expect.objectContaining({ signupIpHash: null }),
      expect.anything(),
    );
  });

  it("추천 인정은 트랜잭션 클라이언트로 실행된다", async () => {
    mocks.applyReferralOnProfileComplete.mockResolvedValue({
      applied: true,
      inviterUserId: "inviter-1",
    });
    await POST(request({ name: "홍길동", phone: "010-1234-5678" }, "referral_code=K4821"));

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.applyReferralOnProfileComplete).toHaveBeenCalledWith(
      expect.anything(),
      TX,
    );
  });

  it("추천 인정이 실패해도 가입은 성공하고 쿠키를 유지한다", async () => {
    mocks.transaction.mockRejectedValue(new Error("db hiccup"));
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678" }, "referral_code=K4821"),
    );

    expect(res.status).toBe(200);
    // 쿠키를 지우지 않아야 한다 (set-cookie 로 referral_code 만료를 보내지 않음)
    expect(res.headers.get("set-cookie") ?? "").not.toContain("referral_code");
  });

  it("추천 인정 결과를 응답에 표면화한다 — 성공 시 referralApplied:true", async () => {
    mocks.applyReferralOnProfileComplete.mockResolvedValue({
      applied: true,
      inviterUserId: "inviter-1",
      referralId: "ref-1",
    });
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678" }, "referral_code=K4821"),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { referralApplied?: boolean };
    expect(json.referralApplied).toBe(true);
    expect(res.headers.get("set-cookie") ?? "").toContain("referral_code");
  });

  it("추천 인정 결과를 응답에 표면화한다 — 거절 시 referralApplied:false", async () => {
    mocks.applyReferralOnProfileComplete.mockResolvedValue({
      applied: false,
      reason: "ALREADY_ATTRIBUTED",
    });
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678" }, "referral_code=K4821"),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { referralApplied?: boolean };
    expect(json.referralApplied).toBe(false);
  });

  it("추천 코드 시도가 없으면 referralApplied 필드를 보내지 않는다", async () => {
    const res = await POST(request({ name: "홍길동", phone: "010-1234-5678" }));

    expect(res.status).toBe(200);
    const json = (await res.json()) as { referralApplied?: boolean };
    expect(json).not.toHaveProperty("referralApplied");
  });

  it("이미 가입 완료된 회원이 보낸 코드는 검증 없이 무시한다", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: {
        id: "user-1",
        profileCompleted: true,
        supabaseId: "sb-1",
        kakaoId: null,
        isActive: true,
      },
      error: null,
    });
    const res = await POST(
      request({ name: "홍길동", phone: "010-1234-5678", referralCode: "ABC12" }),
    );
    expect(res.status).toBe(200);
    expect(mocks.findUniqueUser).not.toHaveBeenCalled();
    expect(mocks.applyReferralOnProfileComplete).not.toHaveBeenCalled();
  });
});
