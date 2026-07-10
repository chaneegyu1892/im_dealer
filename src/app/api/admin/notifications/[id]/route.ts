import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";

const patchSchema = z.object({
  isRead: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const before = await prisma.adminNotification.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json(
        { error: "알림을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    const updated = await prisma.adminNotification.update({
      where: { id },
      data: { isRead: parsed.data.isRead },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "NOTIFICATION_UPDATE",
      resource: "AdminNotification",
      targetId: id,
      before,
      after: updated,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const { id } = await params;
    const before = await prisma.adminNotification.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json(
        { error: "알림을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    await prisma.adminNotification.delete({ where: { id } });

    await logAdminAction({
      request,
      actor: session,
      action: "NOTIFICATION_DELETE",
      resource: "AdminNotification",
      targetId: id,
      before,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/notifications/[id]]", error);
    return NextResponse.json(
      { error: "알림 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
