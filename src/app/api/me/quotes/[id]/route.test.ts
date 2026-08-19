import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  reconcileForQuoteOwner: vi.fn(),
}));

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

vi.mock("@/lib/coupons/reconcile", () => ({
  reconcileCouponsForQuoteOwner: mocks.reconcileForQuoteOwner,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: {
      findFirst: mocks.findFirst,
      update: mocks.update,
    },
  },
}));

import { DELETE } from "./route";

describe("DELETE /api/me/quotes/[id]", () => {
  beforeEach(() => {
    mocks.requireActiveUser.mockReset();
    mocks.findFirst.mockReset();
    mocks.update.mockReset();
    mocks.reconcileForQuoteOwner.mockReset();
    mocks.reconcileForQuoteOwner.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated callers", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: null,
      error: new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 }),
    });

    const res = await DELETE(new Request("http://localhost/api/me/quotes/q1"), {
      params: Promise.resolve({ id: "q1" }),
    });

    expect(res.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("soft-deletes an owned quote", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: { supabaseId: "sb-1" },
      error: null,
    });
    mocks.findFirst.mockResolvedValue({ id: "q1" });
    mocks.update.mockResolvedValue({});

    const res = await DELETE(new Request("http://localhost/api/me/quotes/q1"), {
      params: Promise.resolve({ id: "q1" }),
    });

    expect(res.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "q1", userId: "sb-1", deletedAt: null },
      // 삭제 후 쿠폰 동기화(CONVERTED 판단)에 쓸 스냅숏을 함께 읽는다.
      select: { id: true, userId: true, status: true },
    });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it("returns 404 when the quote is missing or not owned", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      user: { supabaseId: "sb-1" },
      error: null,
    });
    mocks.findFirst.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost/api/me/quotes/q-missing"), {
      params: Promise.resolve({ id: "q-missing" }),
    });

    expect(res.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  // 회원이 직접 지운 CONVERTED 견적도 어드민 삭제(:158-166)와 동일하게 쿠폰
  // 동기화 대상이다 — 안 걸면 PENDING 쿠폰이 사라진 계약 건으로 지급 대기에 남는다.
  describe("쿠폰 reconcile 연동 (T20)", () => {
    it("CONVERTED 견적을 삭제하면 소유 회원 기준으로 쿠폰 동기화를 호출한다", async () => {
      mocks.requireActiveUser.mockResolvedValue({
        user: { supabaseId: "sb-1" },
        error: null,
      });
      mocks.findFirst.mockResolvedValue({
        id: "q1",
        userId: "sb-1",
        status: "CONVERTED",
      });
      mocks.update.mockResolvedValue({});

      const res = await DELETE(new Request("http://localhost/api/me/quotes/q1"), {
        params: Promise.resolve({ id: "q1" }),
      });

      expect(res.status).toBe(200);
      expect(mocks.update).toHaveBeenCalled();
      expect(mocks.reconcileForQuoteOwner).toHaveBeenCalledTimes(1);
      expect(mocks.reconcileForQuoteOwner).toHaveBeenCalledWith("sb-1");
    });

    it("삭제 성공 후 쿠폰 동기화가 실패해도 삭제 응답은 유지된다", async () => {
      mocks.requireActiveUser.mockResolvedValue({
        user: { supabaseId: "sb-1" },
        error: null,
      });
      mocks.findFirst.mockResolvedValue({
        id: "q1",
        userId: "sb-1",
        status: "CONVERTED",
      });
      mocks.update.mockResolvedValue({});
      mocks.reconcileForQuoteOwner.mockRejectedValue(new Error("sync failed"));
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const res = await DELETE(new Request("http://localhost/api/me/quotes/q1"), {
          params: Promise.resolve({ id: "q1" }),
        });

        expect(res.status).toBe(200);
        expect(mocks.update).toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
      }
    });

    it("CONVERTED 가 아닌 견적을 삭제하면 쿠폰 동기화를 호출하지 않는다", async () => {
      mocks.requireActiveUser.mockResolvedValue({
        user: { supabaseId: "sb-1" },
        error: null,
      });
      mocks.findFirst.mockResolvedValue({
        id: "q1",
        userId: "sb-1",
        status: "NEW",
      });
      mocks.update.mockResolvedValue({});

      const res = await DELETE(new Request("http://localhost/api/me/quotes/q1"), {
        params: Promise.resolve({ id: "q1" }),
      });

      expect(res.status).toBe(200);
      expect(mocks.reconcileForQuoteOwner).not.toHaveBeenCalled();
    });
  });
});
