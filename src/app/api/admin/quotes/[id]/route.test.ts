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
  reconcileUserCoupons: vi.fn(),
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
  reconcileUserCoupons: mocks.reconcileUserCoupons,
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
  mocks.reconcileUserCoupons.mockResolvedValue(undefined);
  mocks.findUniqueUser.mockResolvedValue({
    id: "member-1",
    supabaseId: "sb-user-1",
    profileCompleted: true,
  });
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

  // Fix 4: CONVERTED 계약을 소프트 삭제하면 그 순간부터 reconcileUserCoupons 가 계약으로
  // 집계하지 않는다(deletedAt: null 조건). 동기화하지 않으면 PENDING 쿠폰이 남아
  // 사라진 계약 건에 대해 어드민이 지급할 수 있는 유령 지급 대기가 생긴다.
  it("CONVERTED 견적을 소프트 삭제하면 supabaseId 로 회원을 조회하고 reconcileUserCoupons 를 호출한다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      userId: "sb-user-1",
      status: "CONVERTED",
    });

    const response = await DELETE(new NextRequest("https://example.com/api/admin/quotes/quote-1"), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.findUniqueUser).toHaveBeenCalledWith({
      where: { supabaseId: "sb-user-1" },
      select: { id: true, supabaseId: true, profileCompleted: true },
    });
    expect(mocks.reconcileUserCoupons).toHaveBeenCalledWith({
      id: "member-1",
      supabaseId: "sb-user-1",
      profileCompleted: true,
    });
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
    expect(mocks.findUniqueUser).not.toHaveBeenCalled();
    expect(mocks.reconcileUserCoupons).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/quotes/[id] — 쿠폰 동기화 훅", () => {
  // 이 훅이 조용히 죽는 방식: where 절을 supabaseId 에서 id 로 잘못 바꾸면 타입은
  // 그대로 통과하고(둘 다 unique String 컬럼), findUnique 가 null 을 반환하고,
  // `if (member?.supabaseId)` 가드가 그걸 그냥 삼킨다. 그래서 정확한 where 절과
  // reconcileUserCoupons 호출 인자를 둘 다 못박는다.
  it("CONVERTED 전환 시 supabaseId 로 회원을 조회하고 reconcileUserCoupons 를 호출한다", async () => {
    mocks.findFirstQuote.mockResolvedValue({
      id: "quote-1",
      status: "CONTACTED",
      userId: "sb-user-1",
    });

    const response = await PATCH(patchRequest({ status: "CONVERTED" }), {
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.findUniqueUser).toHaveBeenCalledWith({
      where: { supabaseId: "sb-user-1" },
      select: { id: true, supabaseId: true, profileCompleted: true },
    });
    expect(mocks.reconcileUserCoupons).toHaveBeenCalledWith({
      id: "member-1",
      supabaseId: "sb-user-1",
      profileCompleted: true,
    });
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

    expect(mocks.reconcileUserCoupons).toHaveBeenCalledWith({
      id: "member-1",
      supabaseId: "sb-user-1",
      profileCompleted: true,
    });
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

    expect(mocks.reconcileUserCoupons).not.toHaveBeenCalled();
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

    expect(mocks.reconcileUserCoupons).not.toHaveBeenCalled();
  });
});
