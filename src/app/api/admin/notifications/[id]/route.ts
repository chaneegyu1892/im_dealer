import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const id = params.id;
    const body = await request.json();
    const { isRead } = body;

    const updated = await prisma.adminNotification.update({
      where: { id },
      data: { isRead },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/notifications/[id]]", error);
    return NextResponse.json(
      { error: "알림 상태를 업데이트하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
