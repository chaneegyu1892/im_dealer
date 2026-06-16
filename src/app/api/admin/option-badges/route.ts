import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { optionBadgeCreateSchema } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

// ─── GET /api/admin/option-badges ───────────────────────
export async function GET() {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const badges = await prisma.optionBadge.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, displayOrder: true },
    });
    return NextResponse.json({ success: true, data: badges });
  } catch (error) {
    console.error("[GET /api/admin/option-badges]", error);
    return NextResponse.json({ error: "배지 목록 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// ─── POST /api/admin/option-badges ──────────────────────
export async function POST(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const body = await request.json();
    const parsed = optionBadgeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const exists = await prisma.optionBadge.findUnique({ where: { label: parsed.data.label } });
    if (exists) {
      return NextResponse.json({ error: "이미 존재하는 배지 문구입니다." }, { status: 400 });
    }

    const badge = await prisma.optionBadge.create({ data: parsed.data });

    await logAdminAction({
      request,
      actor: session,
      action: "OPTION_BADGE_CREATE",
      resource: "OptionBadge",
      targetId: badge.id,
      after: badge,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: badge }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/option-badges]", error);
    return NextResponse.json({ error: "배지 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
