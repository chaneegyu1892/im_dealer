import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findQuotes: vi.fn(),
  findMembers: vi.fn(),
  findVehicles: vi.fn(),
  listUsers: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    savedQuote: { findMany: mocks.findQuotes },
    user: { findMany: mocks.findMembers },
    vehicle: { findMany: mocks.findVehicles },
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: () => ({
    auth: { admin: { listUsers: mocks.listUsers } },
  }),
}));

import { getAdminUsers } from "./users";

function quote(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: "quote-1",
    sessionId: "session-1",
    userId: null,
    vehicleId: "vehicle-1",
    customerName: "홍길동",
    phone: "010-1234-5678",
    status: "NEW",
    contractMonths: 60,
    monthlyPayment: 650_000,
    convertedAt: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    internalMemo: null,
    ...overrides,
  };
}

describe("getAdminUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMembers.mockResolvedValue([]);
    mocks.findVehicles.mockResolvedValue([{ id: "vehicle-1", name: "테스트 차량" }]);
    mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  });

  it("excludes soft-deleted quotes from CRM aggregation", async () => {
    mocks.findQuotes.mockResolvedValue([quote()]);

    await getAdminUsers();

    expect(mocks.findQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
      })
    );
  });

  it("keeps expired quotes in the consultation count but not in active items", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mocks.findQuotes.mockResolvedValue([
      quote({ id: "quote-expired", expiresAt: past }),
      quote({ id: "quote-live", sessionId: "session-1" }),
    ]);

    const { users } = await getAdminUsers();

    expect(users).toHaveLength(1);
    expect(users[0].consultationCount).toBe(2);
    expect(users[0].activeItems.map((item) => item.quoteId)).toEqual(["quote-live"]);
  });

  it("keeps converted contracts visible even after the quote validity window", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mocks.findQuotes.mockResolvedValue([
      quote({
        id: "quote-converted",
        status: "CONVERTED",
        convertedAt: past,
        expiresAt: past,
      }),
    ]);

    const { users } = await getAdminUsers();

    expect(users[0].activeItems.map((item) => item.quoteId)).toEqual(["quote-converted"]);
    expect(users[0].contractItems).toHaveLength(1);
    expect(users[0].contractItems[0]).toMatchObject({
      quoteId: "quote-converted",
      monthlyPayment: 650_000,
    });
  });
});
