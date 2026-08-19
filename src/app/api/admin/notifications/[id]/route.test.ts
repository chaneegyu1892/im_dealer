import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoleAtLeast: vi.fn(),
  findUnique: vi.fn(),
  notificationUpdate: vi.fn(),
  readUpsert: vi.fn(),
  readDeleteMany: vi.fn(),
  logAdminAction: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: mocks.requireRoleAtLeast,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminNotification: {
      findUnique: mocks.findUnique,
      update: mocks.notificationUpdate,
      delete: vi.fn(),
    },
    adminNotificationRead: {
      upsert: mocks.readUpsert,
      deleteMany: mocks.readDeleteMany,
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.logAdminAction }));

import { PATCH } from "./route";

const ADMIN = { id: "admin-1", role: "admin", name: "관리자" };

function existingNotification() {
  return {
    id: "n-1",
    type: "NEW_QUOTE",
    title: "새 견적",
    content: "새 견적이 접수되었습니다.",
    linkUrl: null,
    isRead: false,
    createdAt: new Date("2026-08-01T00:00:00Z"),
  };
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/notifications/n-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/notifications/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRoleAtLeast.mockResolvedValue({ admin: ADMIN, error: null });
    mocks.findUnique.mockResolvedValue(existingNotification());
    mocks.readUpsert.mockResolvedValue({
      id: "read-1",
      notificationId: "n-1",
      adminUserId: "admin-1",
      readAt: new Date("2026-08-19T00:00:00Z"),
    });
    mocks.readDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("읽음 처리를 요청 관리자의 읽음 기록으로 남긴다(전역 isRead 는 건드리지 않는다)", async () => {
    const response = await PATCH(patchRequest({ isRead: true }), {
      params: Promise.resolve({ id: "n-1" }),
    });

    expect(response.status).toBe(200);
    // 1인 읽음→전원 소실 방지: (notificationId, adminUserId) 복합유니크 upsert.
    expect(mocks.readUpsert).toHaveBeenCalledWith({
      where: {
        notificationId_adminUserId: { notificationId: "n-1", adminUserId: "admin-1" },
      },
      create: {
        notificationId: "n-1",
        adminUserId: "admin-1",
        readAt: expect.any(Date),
      },
      update: { readAt: expect.any(Date) },
    });
    // 전역 isRead 플래그는 하위 호환 컬럼일 뿐 더 이상 갱신하지 않는다.
    expect(mocks.notificationUpdate).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: "n-1", isRead: true });
    expect(mocks.logAdminAction).toHaveBeenCalledTimes(1);
  });

  it("isRead:false 요청은 본인 읽음 기록만 삭제한다", async () => {
    const response = await PATCH(patchRequest({ isRead: false }), {
      params: Promise.resolve({ id: "n-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.readDeleteMany).toHaveBeenCalledWith({
      where: { notificationId: "n-1", adminUserId: "admin-1" },
    });
    expect(mocks.notificationUpdate).not.toHaveBeenCalled();
  });

  it("존재하지 않는 알림은 404", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ isRead: true }), {
      params: Promise.resolve({ id: "n-x" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.readUpsert).not.toHaveBeenCalled();
  });

  it("잘못된 본문은 400", async () => {
    const response = await PATCH(patchRequest({ isRead: "yes" }), {
      params: Promise.resolve({ id: "n-1" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.readUpsert).not.toHaveBeenCalled();
  });
});
