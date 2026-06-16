import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { vehicleReorderSchema } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

// ─── PATCH /api/admin/vehicles/reorder ──────────────────
// 전달된 id 배열 순서대로 displayOrder(0,1,2…)를 부여한다.
// 브랜드별 목록에서 드래그앤드롭으로 정한 순서를 그대로 반영.
export async function PATCH(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const body = await request.json();
    const parsed = vehicleReorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ids } = parsed.data;

    // 전달된 id가 모두 실제 존재하는 차량인지 검증 (외부 입력 신뢰 금지)
    const existing = await prisma.vehicle.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      return NextResponse.json(
        { error: "존재하지 않는 차량이 포함되어 있습니다." },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.vehicle.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    );

    await logAdminAction({
      request,
      actor: session,
      action: "VEHICLE_REORDER",
      resource: "Vehicle",
      targetId: ids[0],
      after: { ids },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/reorder]", error);
    return NextResponse.json(
      { error: "차량 순서 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
