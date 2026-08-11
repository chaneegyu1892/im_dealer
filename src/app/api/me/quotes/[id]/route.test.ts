import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/require-user", () => ({
  requireActiveUser: mocks.requireActiveUser,
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
      select: { id: true },
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
});
