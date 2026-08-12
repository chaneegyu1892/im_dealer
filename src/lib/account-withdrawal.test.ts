import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  quoteFindMany: vi.fn(),
  tokenUpdateMany: vi.fn(),
  reviewUpdateMany: vi.fn(),
  verificationDeleteMany: vi.fn(),
  quoteUpdateMany: vi.fn(),
  calcUpdateMany: vi.fn(),
  couponDeleteMany: vi.fn(),
  referralDeleteMany: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  auditUpdateMany: vi.fn(),
  userUpdate: vi.fn(),
  auditCreate: vi.fn(),
  auditUpdate: vi.fn(),
}));

const tx = {
  savedQuote: { findMany: mocks.quoteFindMany, updateMany: mocks.quoteUpdateMany },
  reviewRequestToken: { updateMany: mocks.tokenUpdateMany },
  review: { updateMany: mocks.reviewUpdateMany },
  customerVerification: { deleteMany: mocks.verificationDeleteMany },
  quoteCalcLog: { updateMany: mocks.calcUpdateMany },
  issuedCoupon: { deleteMany: mocks.couponDeleteMany },
  referral: { deleteMany: mocks.referralDeleteMany },
  quoteDelivery: { updateMany: mocks.deliveryUpdateMany },
  adminAuditLog: { updateMany: mocks.auditUpdateMany, create: mocks.auditCreate },
  user: { update: mocks.userUpdate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    adminAuditLog: { update: mocks.auditUpdate },
  },
}));

import {
  recordSupabaseDeletionOutcome,
  withdrawLocalMember,
} from "@/lib/account-withdrawal";

describe("account withdrawal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      (callback: (client: typeof tx) => unknown) => callback(tx)
    );
    mocks.quoteFindMany.mockResolvedValue([{ id: "quote-1" }]);
    mocks.verificationDeleteMany.mockResolvedValue({ count: 2 });
    mocks.quoteUpdateMany.mockResolvedValue({ count: 3 });
    mocks.calcUpdateMany.mockResolvedValue({ count: 4 });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("deletes verification PII and anonymizes only the withdrawing member's business records", async () => {
    const result = await withdrawLocalMember(
      { id: "local-1", supabaseId: "supabase-1" },
      true
    );

    expect(mocks.verificationDeleteMany).toHaveBeenCalledWith({
      where: { userId: "supabase-1" },
    });
    expect(mocks.quoteUpdateMany).toHaveBeenCalledWith({
      where: { userId: "supabase-1" },
      data: {
        userId: null,
        customerName: null,
        phone: null,
        verificationCapabilityHash: null,
      },
    });
    expect(mocks.calcUpdateMany).toHaveBeenCalledWith({
      where: { userId: "supabase-1" },
      data: { userId: null },
    });
    expect(mocks.couponDeleteMany).toHaveBeenCalledWith({
      where: { userId: "local-1" },
    });
    expect(result).toEqual({
      auditLogId: "audit-1",
      deletedVerifications: 2,
      anonymizedQuotes: 3,
      unlinkedQuoteCalculations: 4,
    });
  });

  it("clears all login/provider identifiers so a later Kakao login creates a new member", async () => {
    await withdrawLocalMember({ id: "local-1", supabaseId: "supabase-1" }, false);

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "local-1" },
      data: expect.objectContaining({
        supabaseId: null,
        email: null,
        name: "탈퇴 회원",
        isActive: false,
        phone: null,
        provider: null,
        kakaoId: null,
        kakaoRefreshToken: null,
        referralCode: null,
      }),
    });
  });

  it("records session/auth cleanup outcome without PII", async () => {
    await recordSupabaseDeletionOutcome(
      {
        auditLogId: "audit-1",
        deletedVerifications: 2,
        anonymizedQuotes: 3,
        unlinkedQuoteCalculations: 4,
      },
      true,
      true
    );

    expect(mocks.auditUpdate).toHaveBeenCalledWith({
      where: { id: "audit-1" },
      data: {
        diff: {
          kakaoUnlinked: true,
          supabaseAuthDeleted: true,
          verificationsDeleted: 2,
          quotesAnonymized: 3,
        },
      },
    });
  });
});
