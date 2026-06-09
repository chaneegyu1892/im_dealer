import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dealerUser = {
  id: "dealer-1",
  supabaseId: "supabase-dealer-1",
  email: "dealer@example.com",
  name: "딜러",
  phone: null,
  role: "dealer",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("admin API role guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("blocks dealers from the admin users API before querying users", async () => {
    const getAdminUsers = vi.fn().mockResolvedValue({ data: [], total: 0 });

    vi.doMock("@/lib/admin-auth", () => ({
      getAdminSession: vi.fn().mockResolvedValue(dealerUser),
    }));
    vi.doMock("@/lib/admin-queries", () => ({ getAdminUsers }));

    const { GET } = await import("@/app/api/admin/users/route");

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(getAdminUsers).not.toHaveBeenCalled();
  });

  it("blocks dealers from the admin analytics API before querying analytics", async () => {
    const getAnalyticsData = vi.fn().mockResolvedValue({});

    vi.doMock("@/lib/admin-auth", () => ({
      getAdminSession: vi.fn().mockResolvedValue(dealerUser),
    }));
    vi.doMock("@/lib/admin-queries", () => ({ getAnalyticsData }));

    const { GET } = await import("@/app/api/admin/analytics/route");

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(getAnalyticsData).not.toHaveBeenCalled();
  });

  it("blocks dealers from saved-quote customer search before querying customer data", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    vi.doMock("@/lib/admin-auth", () => ({
      getAdminSession: vi.fn().mockResolvedValue(dealerUser),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        savedQuote: { findMany },
        vehicle: { findMany: vi.fn().mockResolvedValue([]) },
      },
    }));

    const { GET } = await import("@/app/api/admin/saved-quotes/search/route");
    const request = new NextRequest("https://example.com/api/admin/saved-quotes/search?q=김");

    const response = await GET(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("blocks dealers from global quote listing before querying quotes", async () => {
    const getAdminQuotes = vi.fn().mockResolvedValue({ data: [], total: 0 });

    vi.doMock("@/lib/admin-auth", () => ({
      getAdminSession: vi.fn().mockResolvedValue(dealerUser),
    }));
    vi.doMock("@/lib/admin-queries", () => ({ getAdminQuotes }));

    const { GET } = await import("@/app/api/admin/quotes/route");
    const request = new NextRequest("https://example.com/api/admin/quotes?limit=100");

    const response = await GET(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(getAdminQuotes).not.toHaveBeenCalled();
  });

  it("blocks dealers from dashboard stats before querying aggregate data", async () => {
    const vehicleCount = vi.fn().mockResolvedValue(0);

    vi.doMock("@/lib/admin-auth", () => ({
      getAdminSession: vi.fn().mockResolvedValue(dealerUser),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        vehicle: { count: vehicleCount, findMany: vi.fn().mockResolvedValue([]) },
        quoteCalcLog: { count: vi.fn().mockResolvedValue(0) },
        savedQuote: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
      },
    }));

    const { GET } = await import("@/app/api/admin/dashboard/stats/route");
    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(vehicleCount).not.toHaveBeenCalled();
  });

  it("blocks dealers from issuing review tokens before querying quotes", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    vi.doMock("@/lib/admin-auth", () => ({
      getAdminSession: vi.fn().mockResolvedValue(dealerUser),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        savedQuote: { findUnique },
        reviewRequestToken: { findFirst: vi.fn(), create: vi.fn() },
      },
    }));
    vi.doMock("@/lib/audit", () => ({ logAdminAction: vi.fn() }));

    const { POST } = await import("@/app/api/admin/quotes/[id]/review-token/route");
    const request = new NextRequest("https://example.com/api/admin/quotes/q1/review-token", { method: "POST" });

    const response = await POST(request, { params: Promise.resolve({ id: "q1" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("blocks dealers from quote PDF generation before querying quote data", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    vi.doMock("@/lib/admin-auth", () => ({
      getAdminSession: vi.fn().mockResolvedValue(dealerUser),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        savedQuote: { findFirst },
        vehicle: { findUnique: vi.fn() },
      },
    }));

    const { GET } = await import("@/app/api/admin/quotes/[id]/pdf/route");
    const request = new NextRequest("https://example.com/api/admin/quotes/q1/pdf");

    const response = await GET(request, { params: Promise.resolve({ id: "q1" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("blocks dealers from range-exceeded quote stats before aggregate queries", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);

    vi.doMock("@/lib/admin-auth", () => ({
      getAdminSession: vi.fn().mockResolvedValue(dealerUser),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: queryRaw,
        quoteCalcLog: { count },
      },
    }));

    const { GET } = await import("@/app/api/admin/quote-stats/range-exceeded/route");
    const request = new NextRequest("https://example.com/api/admin/quote-stats/range-exceeded");

    const response = await GET(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "권한이 없습니다." });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});
