import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { vehicleColorUpdateSchema } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string; colorId: string }> };

// ─── PATCH /api/admin/vehicles/[id]/colors/[colorId] ────
export async function PATCH(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id, colorId } = await params;
    const body = await request.json();
    const parsed = vehicleColorUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.vehicleColor.findFirst({
      where: { id: colorId, vehicleId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "색상을 찾을 수 없습니다." }, { status: 404 });
    }

    const color = await prisma.$transaction(async (tx) => {
      // isDefault=true 로 바뀌면 같은 차량/같은 kind 의 다른 기본색 해제
      const willBeDefault = parsed.data.isDefault === true;
      const targetKind = parsed.data.kind ?? existing.kind;
      if (willBeDefault) {
        await tx.vehicleColor.updateMany({
          where: {
            vehicleId: id,
            kind: targetKind,
            isDefault: true,
            id: { not: colorId },
          },
          data: { isDefault: false },
        });
      }
      return tx.vehicleColor.update({
        where: { id: colorId },
        data: parsed.data,
      });
    });

    await logAdminAction({
      request,
      actor: session,
      action: "VEHICLE_COLOR_UPDATE",
      resource: "VehicleColor",
      targetId: colorId,
      before: existing,
      after: color,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: color });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/[id]/colors/[colorId]]", error);
    return NextResponse.json(
      { error: "색상 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/vehicles/[id]/colors/[colorId] ───
export async function DELETE(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id, colorId } = await params;
    const existing = await prisma.vehicleColor.findFirst({
      where: { id: colorId, vehicleId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "색상을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.vehicleColor.delete({ where: { id: colorId } });

    await logAdminAction({
      request,
      actor: session,
      action: "VEHICLE_COLOR_DELETE",
      resource: "VehicleColor",
      targetId: colorId,
      before: existing,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/vehicles/[id]/colors/[colorId]]", error);
    return NextResponse.json(
      { error: "색상 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
