import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  applyReferralStatusAction: vi.fn(),
  logAdminAction: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getAdminSession: mocks.getAdminSession,
}));
vi.mock("@/lib/audit", () => ({
  logAdminAction: mocks.logAdminAction,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../../status", () => ({
  applyReferralStatusAction: mocks.applyReferralStatusAction,
}));

import { POST } from "./route";

const adminUser = {
  id: "admin-1",
  email: "admin@example.com",
  role: "admin",
};
const staffUser = { ...adminUser, id: "staff-1", role: "staff" };

function makeRequest(body: unknown, id = "ref-1") {
  return new NextRequest(`http://localhost/api/admin/referrals/${id}/status`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function call(body: unknown, id = "ref-1") {
  return POST(makeRequest(body, id), {
    params: Promise.resolve({ id }),
  });
}

describe("POST /api/admin/referrals/[id]/status 권한 게이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logAdminAction.mockResolvedValue(undefined);
  });

  it("미인증이면 401 을 내리고 mutation 을 부르지 않는다", async () => {
    mocks.getAdminSession.mockResolvedValue(null);

    const response = await call({ action: "revoke", reason: "사유" });

    expect(response.status).toBe(401);
    expect(mocks.applyReferralStatusAction).not.toHaveBeenCalled();
  });

  it("staff 는 403 — 상태 변경은 admin 이상만", async () => {
    mocks.getAdminSession.mockResolvedValue(staffUser);

    const response = await call({ action: "revoke", reason: "사유" });

    expect(response.status).toBe(403);
    expect(mocks.applyReferralStatusAction).not.toHaveBeenCalled();
  });

  it("알 수 없는 action 은 400", async () => {
    mocks.getAdminSession.mockResolvedValue(adminUser);

    const response = await call({ action: "delete", reason: "사유" });

    expect(response.status).toBe(400);
    expect(mocks.applyReferralStatusAction).not.toHaveBeenCalled();
  });

  it("빈 사유는 400 — 감사 로그가 항상 '왜'를 설명해야 한다", async () => {
    mocks.getAdminSession.mockResolvedValue(adminUser);

    const response = await call({ action: "revoke", reason: "  " });

    expect(response.status).toBe(400);
    expect(mocks.applyReferralStatusAction).not.toHaveBeenCalled();
  });

  it("없는 원장 행은 404", async () => {
    mocks.getAdminSession.mockResolvedValue(adminUser);
    mocks.applyReferralStatusAction.mockResolvedValue({ ok: false, reason: "not_found" });

    const response = await call({ action: "revoke", reason: "사유" });

    expect(response.status).toBe(404);
  });

  it("무효 전이는 400", async () => {
    mocks.getAdminSession.mockResolvedValue(adminUser);
    mocks.applyReferralStatusAction.mockResolvedValue({
      ok: false,
      reason: "invalid_transition",
      action: "revoke",
      status: "BLOCKED",
    });

    const response = await call({ action: "revoke", reason: "사유" });

    expect(response.status).toBe(400);
    expect(mocks.logAdminAction).not.toHaveBeenCalled();
  });

  it("경합 conflict 는 409", async () => {
    mocks.getAdminSession.mockResolvedValue(adminUser);
    mocks.applyReferralStatusAction.mockResolvedValue({ ok: false, reason: "conflict" });

    const response = await call({ action: "revoke", reason: "사유" });

    expect(response.status).toBe(409);
  });

  it("성공(unblock) 은 REFERRAL_UNBLOCKED 감사 로그와 함께 200", async () => {
    mocks.getAdminSession.mockResolvedValue(adminUser);
    const before = {
      id: "ref-1",
      referrerId: "user-a",
      refereeId: "user-b",
      code: "AB12CD",
      status: "BLOCKED",
      signupIpHash: "ip-hash-1",
      createdAt: "2026-08-01T09:00:00.000Z",
    };
    mocks.applyReferralStatusAction.mockResolvedValue({
      ok: true,
      action: "unblock",
      before,
    });

    const response = await call({ action: "unblock", reason: "오판 해제" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REFERRAL_UNBLOCKED",
        resource: "Referral",
        targetId: "ref-1",
        before,
        meta: { reason: "오판 해제" },
      })
    );
  });

  it("성공(revoke) 은 REFERRAL_REVOKED 감사 로그로 200", async () => {
    mocks.getAdminSession.mockResolvedValue(adminUser);
    mocks.applyReferralStatusAction.mockResolvedValue({
      ok: true,
      action: "revoke",
      before: {
        id: "ref-1",
        status: "REWARDED",
        code: "AB12CD",
      },
    });

    const response = await call({ action: "revoke", reason: "보상 철회" });

    expect(response.status).toBe(200);
    expect(mocks.logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REFERRAL_REVOKED" })
    );
  });
});
