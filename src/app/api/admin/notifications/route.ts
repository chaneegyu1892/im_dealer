import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";

export async function GET(request: NextRequest) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "20")));

    const notifications = await prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        // 읽음 판정 SSOT 는 AdminNotificationRead(관리자별). 요청한 관리자의 행만 붙인다.
        reads: { where: { adminUserId: admin.id }, select: { readAt: true } },
      },
    });

    // AdminNotification.isRead(전역) 컬럼은 하위 호환으로 스키마에만 남아 있고
    // 응답의 isRead 는 관리자별 읽음 기록으로 판정한다(1인 읽음→전원 소실 방지).
    const data = notifications.map(({ reads, ...notification }) => ({
      ...notification,
      isRead: reads.length > 0,
      readAt: reads[0]?.readAt ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/notifications]", error);
    return NextResponse.json(
      { error: "알림 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
