import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoleAtLeast: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireRoleAtLeast,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminNotification: { findMany: mocks.findMany },
  },
}));

import { GET } from "./route";

const ADMIN = { id: "admin-1", role: "admin" };

function notificationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "n-1",
    type: "NEW_QUOTE",
    title: "새 견적",
    content: "새 견적이 접수되었습니다.",
    linkUrl: null,
    isRead: false,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

describe("GET /api/admin/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRoleAtLeast.mockResolvedValue({ admin: ADMIN, error: null });
  });

  it("요청한 관리자별 읽음 상태를 조회한다", async () => {
    mocks.findMany.mockResolvedValue([
      { ...notificationRow({ id: "n-1" }), reads: [{ readAt: new Date("2026-08-02T00:00:00Z") }] },
      { ...notificationRow({ id: "n-2", isRead: true }), reads: [] },
    ]);

    const response = await GET(
      new NextRequest("http://localhost/api/admin/notifications?limit=100")
    );

    expect(response.status).toBe(200);
    // 읽음 판정 SSOT 는 AdminNotificationRead — 요청 관리자의 행만 조회한다.
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          reads: { where: { adminUserId: "admin-1" }, select: { readAt: true } },
        },
      })
    );
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ id: "n-1", isRead: true });
    expect(body.data[1]).toMatchObject({ id: "n-2", isRead: false });
    // reads 조인 컬렉션은 응답에 노출하지 않는다.
    expect(body.data[0].reads).toBeUndefined();
    expect(body.data[1].reads).toBeUndefined();
  });

  it("인증되지 않은 요청은 401", async () => {
    mocks.requireRoleAtLeast.mockResolvedValue({
      admin: null,
      error: Response.json({ error: "인증이 필요합니다." }, { status: 401 }),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/admin/notifications")
    );

    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
