import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";

export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "20")));

    const notifications = await prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, data: notifications });
  } catch (error) {
    console.error("[GET /api/admin/notifications]", error);
    return NextResponse.json(
      { error: "알림 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
