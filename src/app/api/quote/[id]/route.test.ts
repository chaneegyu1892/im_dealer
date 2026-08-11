import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveUser: vi.fn(),
  findFirstQuote: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  createActivityLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: { findFirst: mocks.findFirstQuote },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/require-user", () => ({
  getActiveUser: mocks.getActiveUser,
}));

import { DELETE } from "./route";

function context(id = "quote-1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveUser.mockResolvedValue({ id: "member-1", supabaseId: "supabase-user-1" });
  mocks.findFirstQuote.mockResolvedValue({ id: "quote-1", userId: "supabase-user-1" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.createActivityLog.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (callback) => callback({
    savedQuote: { updateMany: mocks.updateMany },
    quoteActivityLog: { create: mocks.createActivityLog },
  }));
});

describe("DELETE /api/quote/[id]", () => {
  it("soft-deletes the owner's quote and writes a deletion audit log", async () => {
    const response = await DELETE(
      new NextRequest("https://example.com/api/quote/quote-1", { method: "DELETE" }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.findFirstQuote).toHaveBeenCalledWith({
      where: { id: "quote-1", deletedAt: null },
      select: { id: true, userId: true },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "quote-1", userId: "supabase-user-1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mocks.createActivityLog).toHaveBeenCalledWith({
      data: {
        quoteId: "quote-1",
        actorId: "member-1",
        action: "DELETED",
      },
    });
  });

  it("rejects a different user's quote without mutating it", async () => {
    mocks.findFirstQuote.mockResolvedValue({ id: "quote-1", userId: "another-supabase-user" });

    const response = await DELETE(
      new NextRequest("https://example.com/api/quote/quote-1", { method: "DELETE" }),
      context(),
    );

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.createActivityLog).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.getActiveUser.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("https://example.com/api/quote/quote-1", { method: "DELETE" }),
      context(),
    );

    expect(response.status).toBe(401);
    expect(mocks.findFirstQuote).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown or malformed quote id", async () => {
    mocks.findFirstQuote.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("https://example.com/api/quote/not-a-quote-id", { method: "DELETE" }),
      context("not-a-quote-id"),
    );

    expect(response.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 without mutation when the quote was already deleted", async () => {
    mocks.findFirstQuote.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest("https://example.com/api/quote/quote-1", { method: "DELETE" }),
      context(),
    );

    expect(response.status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.createActivityLog).not.toHaveBeenCalled();
  });
});
