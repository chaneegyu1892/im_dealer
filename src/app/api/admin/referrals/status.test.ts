import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  applyReferralStatusAction,
  REFERRAL_ALLOWED_TRANSITIONS,
} from "./status";

function row(status: string) {
  return {
    id: "ref-1",
    referrerId: "user-a",
    refereeId: "user-b",
    code: "AB12CD",
    status,
    signupIpHash: "ip-hash-1",
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
  };
}

function makeDb(current: { status: string } | null) {
  return {
    referral: {
      findUnique: vi.fn().mockResolvedValue(current),
      updateMany: vi
        .fn()
        .mockResolvedValue({ count: current?.status === "REWARDED" ? 1 : 0 }),
      deleteMany: vi
        .fn()
        .mockResolvedValue({ count: current?.status === "BLOCKED" ? 1 : 0 }),
    },
  };
}

describe("REFERRAL_ALLOWED_TRANSITIONS", () => {
  it("허용 전이는 REWARDED→REVOKED 뿐이고 REVOKED 는 소급 전이가 없다", () => {
    expect(REFERRAL_ALLOWED_TRANSITIONS).toEqual({
      REWARDED: ["REVOKED"],
      BLOCKED: [],
      REVOKED: [],
    });
  });
});

describe("applyReferralStatusAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("unblock: BLOCKED 행을 삭제해 referee 슬롯을 비운다(재추천 가능)", async () => {
    const db = makeDb(row("BLOCKED"));

    const result = await applyReferralStatusAction(
      "ref-1",
      "unblock",
      "admin-1",
      "오판 해제",
      db as never
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.action).toBe("unblock");
    // 삭제 where 에 status: "BLOCKED" 조건이 있어야 경합 중 상태 변화를 덮어쓰지 않는다.
    expect(db.referral.deleteMany).toHaveBeenCalledWith({
      where: { id: "ref-1", status: "BLOCKED" },
    });
    // 감사 로그 before 로 쓸 원장 스냅샷을 돌려준다.
    expect(result.before.code).toBe("AB12CD");
    expect(result.before.refereeId).toBe("user-b");
  });

  it("revoke: REWARDED → REVOKED 로 조건부 갱신한다", async () => {
    const db = makeDb(row("REWARDED"));

    const result = await applyReferralStatusAction(
      "ref-1",
      "revoke",
      "admin-1",
      "보상 철회",
      db as never
    );

    expect(result.ok).toBe(true);
    expect(db.referral.updateMany).toHaveBeenCalledWith({
      where: { id: "ref-1", status: "REWARDED" },
      data: { status: "REVOKED" },
    });
  });

  it("무효 전이: BLOCKED 에 revoke 는 invalid_transition (400 근거)", async () => {
    const db = makeDb(row("BLOCKED"));

    const result = await applyReferralStatusAction(
      "ref-1",
      "revoke",
      "admin-1",
      "사유",
      db as never
    );

    expect(result).toEqual({
      ok: false,
      reason: "invalid_transition",
      action: "revoke",
      status: "BLOCKED",
    });
    expect(db.referral.updateMany).not.toHaveBeenCalled();
  });

  it("무효 전이: REVOKED 에 revoke 는 소급 복원 불가", async () => {
    const db = makeDb(row("REVOKED"));

    const result = await applyReferralStatusAction(
      "ref-1",
      "revoke",
      "admin-1",
      "사유",
      db as never
    );

    expect(result).toMatchObject({ ok: false, reason: "invalid_transition" });
  });

  it("무효 전이: REWARDED 에 unblock 은 해제 대상이 아니다", async () => {
    const db = makeDb(row("REWARDED"));

    const result = await applyReferralStatusAction(
      "ref-1",
      "unblock",
      "admin-1",
      "사유",
      db as never
    );

    expect(result).toMatchObject({ ok: false, reason: "invalid_transition" });
    expect(db.referral.deleteMany).not.toHaveBeenCalled();
  });

  it("존재하지 않으면 not_found", async () => {
    const db = makeDb(null);

    const result = await applyReferralStatusAction(
      "nope",
      "revoke",
      "admin-1",
      "사유",
      db as never
    );

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("경합: 사전 조회 후 상태가 바뀌어 갱신/삭제 0건이면 conflict 로 실패한다", async () => {
    const db = {
      referral: {
        findUnique: vi.fn().mockResolvedValue(row("REWARDED")),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const result = await applyReferralStatusAction(
      "ref-1",
      "revoke",
      "admin-1",
      "사유",
      db as never
    );

    expect(result).toEqual({ ok: false, reason: "conflict" });
  });

  it("refereeId 유니크 위반이 아닌 삭제 실패는 그대로 던진다", async () => {
    const db = {
      referral: {
        findUnique: vi.fn().mockResolvedValue(row("BLOCKED")),
        updateMany: vi.fn(),
        deleteMany: vi
          .fn()
          .mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("db down", {
              code: "P2021",
              clientVersion: "6.0.0",
            })
          ),
      },
    };

    await expect(
      applyReferralStatusAction("ref-1", "unblock", "admin-1", "사유", db as never)
    ).rejects.toThrow();
  });
});
