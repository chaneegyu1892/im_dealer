import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const dealerUser = {
  id: "dealer-1",
  supabaseId: "sb-dealer-1",
  email: "dealer@example.com",
  name: "딜러",
  phone: null,
  role: "dealer",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};
const staffUser = { ...dealerUser, id: "staff-1", email: "staff@example.com", role: "staff" };
const adminUser = { ...dealerUser, id: "admin-1", email: "admin@example.com", role: "admin" };

function mockSession(user: typeof dealerUser) {
  vi.doMock("@/lib/admin-auth", () => ({
    getAdminSession: vi.fn().mockResolvedValue(user),
  }));
}

describe("어드민 쿠폰 API 권한", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("staff 는 정책 API 에 접근할 수 없다", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    mockSession(staffUser);
    vi.doMock("@/lib/prisma", () => ({ prisma: { couponPolicy: { findMany } } }));

    const { GET } = await import("@/app/api/admin/coupons/policies/route");
    const response = await GET();

    expect(response.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("admin 은 정책 API 를 조회할 수 있다", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    mockSession(adminUser);
    vi.doMock("@/lib/prisma", () => ({ prisma: { couponPolicy: { findMany } } }));

    const { GET } = await import("@/app/api/admin/coupons/policies/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it("dealer 는 발급 현황 API 에 접근할 수 없다", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    mockSession(dealerUser);
    vi.doMock("@/lib/prisma", () => ({ prisma: { issuedCoupon: { findMany } } }));

    const { GET } = await import("@/app/api/admin/coupons/issued/route");
    const response = await GET(new NextRequest("http://localhost/api/admin/coupons/issued"));

    expect(response.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("staff 는 발급 현황 API 를 조회할 수 있다", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    mockSession(staffUser);
    vi.doMock("@/lib/prisma", () => ({ prisma: { issuedCoupon: { findMany } } }));

    const { GET } = await import("@/app/api/admin/coupons/issued/route");
    const response = await GET(new NextRequest("http://localhost/api/admin/coupons/issued"));

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it("dealer 는 지급 처리 API 에 접근할 수 없다", async () => {
    const payIssuedCoupon = vi.fn();
    mockSession(dealerUser);
    vi.doMock("@/lib/prisma", () => ({ prisma: {} }));
    vi.doMock("@/app/api/admin/coupons/issued/pay", () => ({ payIssuedCoupon }));

    const { POST } = await import("@/app/api/admin/coupons/issued/[id]/pay/route");
    const response = await POST(
      new NextRequest("http://localhost/api/admin/coupons/issued/c1/pay", { method: "POST" }),
      { params: Promise.resolve({ id: "c1" }) }
    );

    expect(response.status).toBe(403);
    expect(payIssuedCoupon).not.toHaveBeenCalled();
  });
});
