import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

// DELETE /api/admin/capital-rates/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const { id } = await params;
    const before = await prisma.capitalRateSheet.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "없는 시트" }, { status: 404 });
    }
    await prisma.capitalRateSheet.delete({ where: { id } });

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
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    const parsedBody = z
      .object({ memo: z.string().optional(), setActive: z.boolean().optional() })
      .strict()
      .parse(body);
    const { memo, setActive } = parsedBody;
    const db = prisma;
    const before = await db.capitalRateSheet.findUnique({ where: { id } });

    if (setActive === true) {
      if (!before) return NextResponse.json({ error: "없는 시트" }, { status: 404 });

      // 형제 시트 비활성화 + 대상 활성화를 단일 트랜잭션으로 묶어
      // 중간 실패 시 (financeCompany, trim)에 활성 시트가 0개가 되는 것을 방지.
      await prisma.$transaction([
        db.capitalRateSheet.updateMany({
          where: { financeCompanyId: before.financeCompanyId, trimId: before.trimId, isActive: true },
          data: { isActive: false },
        }),
        db.capitalRateSheet.update({ where: { id }, data: { isActive: true } }),
      ]);
    } else if (setActive === false) {
      // 비활성화 — 해당 트림을 '데이터 없음' 상태로(시트는 이력에 남아 재활성화 가능)
      if (!before) return NextResponse.json({ error: "없는 시트" }, { status: 404 });
      await db.capitalRateSheet.update({ where: { id }, data: { isActive: false } });
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
