import { beforeEach, describe, expect, it, vi } from "vitest";
import { payIssuedCoupon } from "./pay";

function makeDb(current: { status: string } | null) {
  return {
    issuedCoupon: {
      findUnique: vi.fn().mockResolvedValue(current),
      updateMany: vi.fn().mockResolvedValue({ count: current?.status === "PENDING" ? 1 : 0 }),
    },
  };
}

describe("payIssuedCoupon", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PENDING 쿠폰을 PAID 로 바꾼다", async () => {
    const db = makeDb({ status: "PENDING" });

    const result = await payIssuedCoupon("coupon-1", "admin-1", "상품권 발송", db as never);

    expect(result.ok).toBe(true);
    expect(db.issuedCoupon.updateMany).toHaveBeenCalledWith({
      where: { id: "coupon-1", status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: expect.any(Date),
        paidBy: "admin-1",
        paidMemo: "상품권 발송",
      },
    });
  });

  it("존재하지 않으면 not_found 를 준다", async () => {
    const db = makeDb(null);

    const result = await payIssuedCoupon("nope", "admin-1", null, db as never);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("PENDING 이 아니면 invalid_status 를 주고 쓰기를 하지 않는다", async () => {
    const db = makeDb({ status: "HELD" });

    const result = await payIssuedCoupon("coupon-1", "admin-1", null, db as never);

    expect(result).toEqual({ ok: false, reason: "invalid_status", status: "HELD" });
    expect(db.issuedCoupon.updateMany).not.toHaveBeenCalled();
  });

  it("이미 PAID 면 invalid_status 를 준다", async () => {
    const db = makeDb({ status: "PAID" });

    const result = await payIssuedCoupon("coupon-1", "admin-1", null, db as never);

    expect(result).toEqual({ ok: false, reason: "invalid_status", status: "PAID" });
  });

  // 이중 지급을 실제로 막는 분기. 사전 조회 때는 PENDING 이었지만 그 사이 다른 요청이 먼저
  // 지급해 updateMany 가 0건을 매칭하는 상황이다. makeDb 는 갱신 건수를 사전 조회 상태에
  // 묶어두므로 이 케이스를 만들 수 없어 db 를 직접 만든다.
  it("동시 요청에 밀려 갱신 건수가 0이면 성공으로 떨어지지 않는다", async () => {
    const db = {
      issuedCoupon: {
        findUnique: vi.fn().mockResolvedValue({ status: "PENDING" }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const result = await payIssuedCoupon("coupon-1", "admin-1", null, db as never);

    expect(result).toEqual({ ok: false, reason: "invalid_status", status: "PENDING" });
    expect(db.issuedCoupon.updateMany).toHaveBeenCalledOnce();
  });
});
