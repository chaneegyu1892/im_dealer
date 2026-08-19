import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoleAtLeast: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  revokeTokens: vi.fn(),
  createActivityLog: vi.fn(),
  findFirstQuote: vi.fn(),
  updateQuote: vi.fn(),
  findUniqueUser: vi.fn(),
  reconcileForQuoteOwner: vi.fn(),
  requestReviewAlimtalkForQuote: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    savedQuote: {
      findFirst: mocks.findFirstQuote,
      update: mocks.updateQuote,
    },
    quoteActivityLog: {
      create: mocks.createActivityLog,
    },
    user: {
      findUnique: mocks.findUniqueUser,
    },
  },
}));

vi.mock("@/lib/supabase/storage", () => ({
  REVIEW_IMAGE_MAX_SIZE: 5,
  reviewImagePublicUrl: (path: string) => `https://cdn.example/${path}`,
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireRoleAtLeast,
}));

vi.mock("@/lib/coupons/reconcile", () => ({
  reconcileCouponsForQuoteOwner: mocks.reconcileForQuoteOwner,
}));

vi.mock("@/lib/review-request-alimtalk", () => ({
  requestReviewAlimtalkForQuote: mocks.requestReviewAlimtalkForQuote,
}));

vi.mock("@/lib/admin-notification", () => ({
  notifyAdminOnce: vi.fn(),
}));

import { DELETE, PATCH } from "./route";

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/admin/quotes/quote-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRoleAtLeast.mockResolvedValue({
    admin: { id: "staff-1" },
    error: null,
  });
  // DELETE 는 $transaction 을 콜백 형태로, PATCH 는 배열(이미 만들어진 프라미스들) 형태로
  // 부른다. 두 형태를 모두 지원해야 한 파일에서 DELETE·PATCH 테스트를 같이 둘 수 있다.
  mocks.transaction.mockImplementation(async (arg) => {
    if (typeof arg === "function") {
      return arg({
        savedQuote: { updateMany: mocks.updateMany },
        reviewRequestToken: { updateMany: mocks.revokeTokens },
        quoteActivityLog: { create: mocks.createActivityLog },
      });
    }
    return Promise.all(arg);
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.revokeTokens.mockResolvedValue({ count: 1 });
  mocks.createActivityLog.mockResolvedValue({});
  mocks.updateQuote.mockResolvedValue({});
  mocks.reconcileForQuoteOwner.mockResolvedValue(undefined);
  mocks.requestReviewAlimtalkForQuote.mockResolvedValue({ ok: true });
});

describe("DELETE /api/admin/quotes/[id]", () => {
  it("soft-deletes the audit row while erasing its customer contact", async () => {
    const response = await DELETE(new NextRequest("https://example.com/api/admin/quotes/quote-1"), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "quote-1", deletedAt: null },
      data: {
        deletedAt: expect.any(Date),
        customerName: null,
        phone: null,
        verificationCapabilityHash: null,
      },
    });
    expect(mocks.revokeTokens).toHaveBeenCalledWith({
      where: {
        savedQuoteId: "quote-1",
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.createActivityLog).toHaveBeenCalledWith({
      data: {
        quoteId: "quote-1",
        actorId: "staff-1",
        action: "DELETED",
        payload: { soft: "true" },
      },
    });
  });

  // Fix 4: CONVERTED 계약을 소프트 삭제하면 그 순간부터 쿠폰 동기화가 계약으로
  // 집계하지 않는다(deletedAt: null 조건). 동기화하지 않으면 PENDING 쿠폰이 남아
  // 사라진 계약 건에 대해 어드민이 지급할 수 있는 유령 지급 대기가 생긴다.
  // 회원 조회·추천인 동기화의 정밀 검증은 reconcile.test.ts 의
  // reconcileCouponsForQuoteOwner 테스트가 담당한다.
  it("CONVERTED 견적을 소프트 삭제하면 소유자 기준 쿠폰 동기화를 호출한다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      userId: "sb-user-1",
      status: "CONVERTED",
    });

    const response = await DELETE(new NextRequest("https://example.com/api/admin/quotes/quote-1"), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.reconcileForQuoteOwner).toHaveBeenCalledWith("sb-user-1");
  });

  it("CONVERTED 가 아닌 견적을 소프트 삭제하면 훅이 호출되지 않는다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      userId: "sb-user-1",
      status: "CONTACTED",
    });

    const response = await DELETE(new NextRequest("https://example.com/api/admin/quotes/quote-1"), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.reconcileForQuoteOwner).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/quotes/[id] — 쿠폰 동기화 훅", () => {
  // 회원 조회 where 절·추천인 동기화의 정밀 검증은 reconcile.test.ts 의
  // reconcileCouponsForQuoteOwner 테스트가 담당한다. 여기서는 훅이 올바른
  // 조건에서, 견적 소유자(supabaseId)를 인자로 호출되는지를 못박는다.
  it("CONVERTED 전환 시 소유자 기준 쿠폰 동기화를 호출한다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      id: "quote-1",
      status: "CONTACTED",
      userId: "sb-user-1",
    });

    const response = await PATCH(patchRequest({ status: "CONVERTED" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.reconcileForQuoteOwner).toHaveBeenCalledWith("sb-user-1");
  });

  // Fix 2: CONVERTED → LOST 로 철회되는 방향도 훅이 잡아야 한다. 안 잡으면 쿠폰이
  // PENDING 에 남아 이미 철회된 계약을 어드민이 계속 지급 대기로 본다.
  it("CONVERTED → LOST 전환에서도 훅이 호출된다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      id: "quote-1",
      status: "CONVERTED",
      userId: "sb-user-1",
    });

    await PATCH(patchRequest({ status: "LOST" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(mocks.reconcileForQuoteOwner).toHaveBeenCalledWith("sb-user-1");
  });

  it("CONVERTED 를 어느 쪽으로도 건드리지 않는 전환에서는 훅이 호출되지 않는다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      id: "quote-1",
      status: "CONTACTED",
      userId: "sb-user-1",
    });

    await PATCH(patchRequest({ status: "LOST" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(mocks.reconcileForQuoteOwner).not.toHaveBeenCalled();
  });

  it("상태 변경이 없으면(LOST → LOST) 훅이 호출되지 않는다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      id: "quote-1",
      status: "LOST",
      userId: "sb-user-1",
    });

    await PATCH(patchRequest({ status: "LOST" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(mocks.reconcileForQuoteOwner).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/quotes/[id] — 후기 요청 알림톡 훅", () => {
  it("CONTACTED→CONVERTED 전환에서 requestReviewAlimtalkForQuote 를 한 번 호출한다", async () => {
    const quote = {
      id: "quote-1",
      status: "CONTACTED",
      userId: "sb-user-1",
      phone: "010-1234-5678",
      customerName: "홍길동",
    };
    mocks.findFirstQuote.mockResolvedValue(quote);

    const response = await PATCH(patchRequest({ status: "CONVERTED" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.requestReviewAlimtalkForQuote).toHaveBeenCalledTimes(1);
    expect(mocks.requestReviewAlimtalkForQuote).toHaveBeenCalledWith({
      quote,
      actorId: "staff-1",
    });
  });

  it("CONVERTED→LOST 전환에서는 후기 훅을 호출하지 않고 쿠폰 훅은 호출한다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      id: "quote-1",
      status: "CONVERTED",
      userId: "sb-user-1",
    });

    const response = await PATCH(patchRequest({ status: "LOST" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.requestReviewAlimtalkForQuote).not.toHaveBeenCalled();
    expect(mocks.reconcileForQuoteOwner).toHaveBeenCalledWith("sb-user-1");
  });

  it("CONTACTED→LOST 전환에서는 후기 훅을 호출하지 않는다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      id: "quote-1",
      status: "CONTACTED",
      userId: "sb-user-1",
    });

    const response = await PATCH(patchRequest({ status: "LOST" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.requestReviewAlimtalkForQuote).not.toHaveBeenCalled();
  });

  it("후기 훅이 던져도 PATCH 는 200 이고 로그에 전화번호를 넣지 않는다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      id: "quote-1",
      status: "CONTACTED",
      userId: "sb-user-1",
      phone: "010-1234-5678",
      customerName: "홍길동",
    });
    mocks.requestReviewAlimtalkForQuote.mockRejectedValue(new Error("enqueue exploded"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await PATCH(patchRequest({ status: "CONVERTED" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(errorSpy).toHaveBeenCalledWith(
      "[PATCH /api/admin/quotes/[id]] review-request enqueue failed",
      { quoteId: "quote-1" },
    );
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain("010-1234-5678");
    expect(logged).not.toContain("01012345678");
    expect(logged).not.toContain("홍길동");
    errorSpy.mockRestore();
  });
});
