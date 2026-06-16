import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { optionReorderSchema } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ trimId: string }> };

// ─── PATCH /api/admin/trims/[trimId]/options/reorder ────
// 전달된 옵션 id 배열 순서대로 displayOrder(0,1,2…)를 부여한다.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { trimId } = await params;
    const body = await request.json();
    const parsed = optionReorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ids } = parsed.data;

    // 전달된 옵션이 모두 해당 트림 소속인지 검증 (외부 입력 신뢰 금지)
    const owned = await prisma.trimOption.findMany({
      where: { id: { in: ids }, trimId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return NextResponse.json(
        { error: "이 트림에 속하지 않은 옵션이 포함되어 있습니다." },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.trimOption.update({ where: { id }, data: { displayOrder: index } })
      )
    );

    await logAdminAction({
      request,
      actor: session,
      action: "OPTION_REORDER",
      resource: "TrimOption",
      targetId: trimId,
      after: { ids },
      meta: { trimId },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/admin/trims/[trimId]/options/reorder]", error);
    return NextResponse.json({ error: "옵션 순서 저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
