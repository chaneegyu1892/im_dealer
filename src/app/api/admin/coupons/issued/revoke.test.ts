import { beforeEach, describe, expect, it, vi } from "vitest";
import { revokeIssuedCoupon } from "./revoke";

function makeDb(current: { status: string } | null) {
  const revocable = current && (current.status === "PENDING" || current.status === "PAID");
  return {
    issuedCoupon: {
      findUnique: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: revocable ? 1 : 0 }),
    },
  };
}

describe("revokeIssuedCoupon", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PENDING 쿠폰을 REVOKED 로 바꾼다", async () => {
    const db = makeDb({ status: "PENDING" });

    const result = await revokeIssuedCoupon("coupon-1", "admin-1", "오발급", db as never);

    expect(result.ok).toBe(true);
    expect(db.issuedCoupon.updateMany).toHaveBeenCalledWith({
      where: { id: "coupon-1", status: { in: ["PENDING", "PAID"] } },
      data: {
        status: "REVOKED",
        revokedAt: expect.any(Date),
        revokeReason: "오발급",
      },
    });
  });

  it("PAID 쿠폰도 회수(지급 취소) 할 수 있다", async () => {
    const db = makeDb({ status: "PAID" });

    const result = await revokeIssuedCoupon("coupon-1", "admin-1", "클레임 접수", db as never);

    expect(result.ok).toBe(true);
  });

  it("존재하지 않으면 not_found 를 준다", async () => {
    const db = makeDb(null);

    const result = await revokeIssuedCoupon("nope", "admin-1", "사유", db as never);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("HELD 쿠폰은 취소 대상이 아니다", async () => {
    const db = makeDb({ status: "HELD" });

    const result = await revokeIssuedCoupon("coupon-1", "admin-1", "사유", db as never);

    expect(result).toEqual({ ok: false, reason: "invalid_status", status: "HELD" });
    expect(db.issuedCoupon.updateMany).not.toHaveBeenCalled();
  });

  it("EXPIRED 쿠폰은 취소 대상이 아니다", async () => {
    const db = makeDb({ status: "EXPIRED" });

    const result = await revokeIssuedCoupon("coupon-1", "admin-1", "사유", db as never);

    expect(result).toEqual({ ok: false, reason: "invalid_status", status: "EXPIRED" });
    expect(db.issuedCoupon.updateMany).not.toHaveBeenCalled();
  });

  // 사전 조회 때는 PENDING 이었지만 그 사이 reconcile 이 상태를 바꿔 updateMany 가
  // 0건을 매칭하는 상황. 성공으로 넘어가면 안 된다.
  it("동시 요청에 밀려 갱신 건수가 0이면 성공으로 떨어지지 않는다", async () => {
    const db = {
      issuedCoupon: {
        findUnique: vi.fn().mockResolvedValue({ status: "PENDING" }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const result = await revokeIssuedCoupon("coupon-1", "admin-1", "사유", db as never);

    expect(result).toEqual({ ok: false, reason: "invalid_status", status: "PENDING" });
    expect(db.issuedCoupon.updateMany).toHaveBeenCalledOnce();
  });

  it("reason 이 null 이어도 회수할 수 있다", async () => {
    const db = makeDb({ status: "PENDING" });

    const result = await revokeIssuedCoupon("coupon-1", "admin-1", null, db as never);

    expect(result.ok).toBe(true);
    expect(db.issuedCoupon.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokeReason: null }) })
    );
  });
});
