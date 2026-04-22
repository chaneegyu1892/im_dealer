import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { vehicleUpdateSchema } from "@/lib/validations/admin";
import { getAdminSession } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/admin/vehicles/[id] ───────────────────────
export async function GET(_request: NextRequest, { params }: Params) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        lineups: { orderBy: { createdAt: "asc" } },
        trims: {
          orderBy: [{ isDefault: "desc" }, { price: "asc" }],
          include: { options: { orderBy: { price: "asc" } } },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("[GET /api/admin/vehicles/[id]]", error);
    return NextResponse.json(
      { error: "차량 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/admin/vehicles/[id] ─────────────────────
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = vehicleUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: vehicle });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/[id]]", error);
    return NextResponse.json(
      { error: "차량 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/vehicles/[id] ────────────────────
export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { id } = await params;
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.vehicle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/vehicles/[id]]", error);
    return NextResponse.json(
      { error: "차량 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
