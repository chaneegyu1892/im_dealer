import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  findVehicle: vi.fn(),
  findExistingQuote: vi.fn(),
  findCurrentQuote: vi.fn(),
  createQuote: vi.fn(),
  updateQuotes: vi.fn(),
  transaction: vi.fn(),
  createAdminNotification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    vehicle: { findUnique: mocks.findVehicle },
    trimOption: { findMany: vi.fn() },
    vehicleColor: { findMany: vi.fn() },
    savedQuote: {
      findUnique: mocks.findExistingQuote,
      findUniqueOrThrow: mocks.findCurrentQuote,
      create: mocks.createQuote,
      updateMany: mocks.updateQuotes,
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock("@/lib/admin-notification", () => ({
  createAdminNotification: mocks.createAdminNotification,
}));

function request(): NextRequest {
  return new NextRequest("https://example.com/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-1",
      vehicleId: "vehicle-1",
      trimId: "trim-1",
      contractMonths: 60,
      annualMileage: 20000,
      depositRate: 10,
      prepayRate: 0,
      contractType: "반납형",
      customerType: "individual",
      monthlyPayment: 650000,
      totalCost: 39000000,
      quoteType: "AI",
      customerName: "홍길동",
      phone: "01012345678",
    }),
  });
}

describe("POST /api/quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.findVehicle.mockResolvedValue({ id: "vehicle-1" });
    mocks.findExistingQuote.mockResolvedValue({
      id: "quote-1",
      sessionId: "session-1",
      userId: null,
      deletedAt: null,
      customerName: null,
      phone: null,
    });
    mocks.findCurrentQuote.mockResolvedValue({
      id: "quote-1",
      sessionId: "session-1",
      monthlyPayment: 650000,
      internalMemo: "admin-only",
    });
    mocks.updateQuotes.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback({
      savedQuote: {
        findUnique: mocks.findExistingQuote,
        findUniqueOrThrow: mocks.findCurrentQuote,
        updateMany: mocks.updateQuotes,
      },
      adminNotification: { create: vi.fn() },
    }));
    mocks.createQuote.mockResolvedValue({ id: "quote-new", monthlyPayment: 650000 });
    mocks.createAdminNotification.mockResolvedValue(undefined);
  });

  it("updates the pre-verification quote instead of creating a duplicate", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.findExistingQuote).toHaveBeenCalledWith({
      where: { sessionId: "session-1" },
      select: { id: true, userId: true, deletedAt: true },
    });
    expect(mocks.updateQuotes).toHaveBeenCalledWith(
      {
        where: {
          id: "quote-1",
          deletedAt: null,
          OR: [{ userId: null }, { userId: "user-1" }],
          customerName: null,
          phone: null,
        },
        data: {
          userId: "user-1",
          customerName: "홍길동",
          phone: "01012345678",
        },
      }
    );
    expect(mocks.createQuote).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      success: true,
      data: { id: "quote-1", sessionId: "session-1" },
    });
  });

  it("requires authentication before enriching a saved quote", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.findExistingQuote).not.toHaveBeenCalled();
  });

  it("rejects verification enrichment when no server-calculated quote exists", async () => {
    mocks.findExistingQuote.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.createQuote).not.toHaveBeenCalled();
  });

  it("does not repeat the admin notification after customer details are already present", async () => {
    mocks.findExistingQuote.mockResolvedValue({
      id: "quote-1",
      sessionId: "session-1",
      userId: "user-1",
      deletedAt: null,
      customerName: "홍길동",
      phone: "01012345678",
    });
    mocks.updateQuotes
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.createAdminNotification).not.toHaveBeenCalled();
  });

  it("retries the atomic notification when the first notification insert fails", async () => {
    mocks.createAdminNotification
      .mockRejectedValueOnce(new Error("temporary notification failure"))
      .mockResolvedValueOnce(undefined);

    const first = await POST(request());
    const second = await POST(request());

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.createAdminNotification).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
  });

  it("claims the notification only once across concurrent enrichment requests", async () => {
    let notificationClaims = 0;
    mocks.updateQuotes.mockImplementation(async ({ where }) => {
      if ("customerName" in where) {
        notificationClaims += 1;
        return { count: notificationClaims === 1 ? 1 : 0 };
      }
      return { count: 1 };
    });

    const responses = await Promise.all([POST(request()), POST(request())]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(mocks.createAdminNotification).toHaveBeenCalledTimes(1);
  });
});
