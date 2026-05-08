import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { vehicleColorCreateSchema } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/admin/vehicles/[id]/colors ────────────────
export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } });
    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }
    const colors = await prisma.vehicleColor.findMany({
      where: { vehicleId: id },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ success: true, data: colors });
  } catch (error) {
    console.error("[GET /api/admin/vehicles/[id]/colors]", error);
    return NextResponse.json(
      { error: "색상 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── POST /api/admin/vehicles/[id]/colors ───────────────
export async function POST(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = vehicleColorCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } });
    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    const color = await prisma.$transaction(async (tx) => {
      // isDefault=true 시 같은 차량/같은 kind의 다른 항목 자동 해제
      if (parsed.data.isDefault) {
        await tx.vehicleColor.updateMany({
          where: { vehicleId: id, kind: parsed.data.kind, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.vehicleColor.create({
        data: { ...parsed.data, vehicleId: id },
      });
    });

    await logAdminAction({
      request,
      actor: session,
      action: "VEHICLE_COLOR_CREATE",
      resource: "VehicleColor",
      targetId: color.id,
      after: color,
      meta: { vehicleId: id },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: color }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/vehicles/[id]/colors]", error);
    return NextResponse.json(
      { error: "색상 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
