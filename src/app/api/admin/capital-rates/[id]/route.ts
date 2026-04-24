import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// DELETE /api/admin/capital-rates/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await (prisma as any).capitalRateSheet.delete({ where: { id } });
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
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { memo, setActive } = body as { memo?: string; setActive?: boolean };
    const db = prisma as any;

    if (setActive) {
      const target = await db.capitalRateSheet.findUnique({ where: { id } });
      if (!target) return NextResponse.json({ error: "없는 시트" }, { status: 404 });

      await db.capitalRateSheet.updateMany({
        where: { financeCompanyId: target.financeCompanyId, trimId: target.trimId, isActive: true },
        data: { isActive: false },
      });
      await db.capitalRateSheet.update({ where: { id }, data: { isActive: true } });
    } else if (memo !== undefined) {
      await db.capitalRateSheet.update({ where: { id }, data: { memo } });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
}
