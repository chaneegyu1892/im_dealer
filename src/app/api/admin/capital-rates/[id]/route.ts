import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

// DELETE /api/admin/capital-rates/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const before = await (prisma as any).capitalRateSheet.findUnique({ where: { id } });
    await (prisma as any).capitalRateSheet.delete({ where: { id } });

    await logAdminAction({
      request,
      actor: session,
      action: "RATE_SHEET_DELETE",
      resource: "CapitalRateSheet",
      targetId: id,
      before,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}

// PATCH /api/admin/capital-rates/[id] — 메모 수정 또는 활성화
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { memo, setActive } = body as { memo?: string; setActive?: boolean };
    const db = prisma as any;
    const before = await db.capitalRateSheet.findUnique({ where: { id } });

    if (setActive) {
      if (!before) return NextResponse.json({ error: "없는 시트" }, { status: 404 });

      await db.capitalRateSheet.updateMany({
        where: { financeCompanyId: before.financeCompanyId, trimId: before.trimId, isActive: true },
        data: { isActive: false },
      });
      await db.capitalRateSheet.update({ where: { id }, data: { isActive: true } });
    } else if (memo !== undefined) {
      await db.capitalRateSheet.update({ where: { id }, data: { memo } });
    }

    const after = await db.capitalRateSheet.findUnique({ where: { id } });
    await logAdminAction({
      request,
      actor: session,
      action: "RATE_SHEET_UPDATE",
      resource: "CapitalRateSheet",
      targetId: id,
      before,
      after,
      meta: setActive ? { setActive: true } : undefined,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
