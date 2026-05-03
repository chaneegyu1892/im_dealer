import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lineupCreateSchema } from "@/lib/validations/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/admin/vehicles/[id]/lineups ───────────────
export async function GET(_request: NextRequest, { params }: Params) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const lineups = await prisma.vehicleLineup.findMany({
      where: { vehicleId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ success: true, data: lineups });
  } catch (error) {
    console.error("[GET /api/admin/vehicles/[id]/lineups]", error);
    return NextResponse.json({ error: "라인업 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// ─── POST /api/admin/vehicles/[id]/lineups ──────────────
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = lineupCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const lineup = await prisma.vehicleLineup.create({
      data: {
        ...parsed.data,
        vehicleId: id,
      },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "LINEUP_CREATE",
      resource: "VehicleLineup",
      targetId: lineup.id,
      after: lineup,
      meta: { vehicleId: id },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: lineup }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/vehicles/[id]/lineups]", error);
    return NextResponse.json({ error: "라인업 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
