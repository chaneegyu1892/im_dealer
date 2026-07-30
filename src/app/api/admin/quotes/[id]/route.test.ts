import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoleAtLeast: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  revokeTokens: vi.fn(),
  createActivityLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/supabase/storage", () => ({
  REVIEW_IMAGE_MAX_SIZE: 5,
  reviewImagePublicUrl: (path: string) => `https://cdn.example/${path}`,
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireRoleAtLeast,
}));

import { DELETE } from "./route";

describe("DELETE /api/admin/quotes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRoleAtLeast.mockResolvedValue({
      admin: { id: "staff-1" },
      error: null,
    });
    mocks.transaction.mockImplementation(async (callback) => callback({
      savedQuote: { updateMany: mocks.updateMany },
      reviewRequestToken: { updateMany: mocks.revokeTokens },
      quoteActivityLog: { create: mocks.createActivityLog },
    }));
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.revokeTokens.mockResolvedValue({ count: 1 });
    mocks.createActivityLog.mockResolvedValue({});
  });

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
});
