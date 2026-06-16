import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { optionBadgeUpdateSchema } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string }> };

// ─── PATCH /api/admin/option-badges/[id] ────────────────
export async function PATCH(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = optionBadgeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 라벨 변경 시 중복 검사
    if (parsed.data.label) {
      const dup = await prisma.optionBadge.findFirst({
        where: { label: parsed.data.label, NOT: { id } },
      });
      if (dup) {
        return NextResponse.json({ error: "이미 존재하는 배지 문구입니다." }, { status: 400 });
      }
    }

    const before = await prisma.optionBadge.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "배지를 찾을 수 없습니다." }, { status: 404 });
    }
    const badge = await prisma.optionBadge.update({ where: { id }, data: parsed.data });

    await logAdminAction({
      request,
      actor: session,
      action: "OPTION_BADGE_UPDATE",
      resource: "OptionBadge",
      targetId: id,
      before,
      after: badge,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: badge });
  } catch (error) {
    console.error("[PATCH /api/admin/option-badges/[id]]", error);
    return NextResponse.json({ error: "배지 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// ─── DELETE /api/admin/option-badges/[id] ───────────────
// 배지 삭제 시 이 배지를 단 옵션들의 badgeId 는 FK onDelete: SetNull 로 자동 해제된다.
export async function DELETE(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const before = await prisma.optionBadge.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "배지를 찾을 수 없습니다." }, { status: 404 });
    }
    await prisma.optionBadge.delete({ where: { id } });

    await logAdminAction({
      request,
      actor: session,
      action: "OPTION_BADGE_DELETE",
      resource: "OptionBadge",
      targetId: id,
      before,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/option-badges/[id]]", error);
    return NextResponse.json({ error: "배지 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
