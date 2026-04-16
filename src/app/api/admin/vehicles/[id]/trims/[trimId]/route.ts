import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { trimUpdateSchema } from "@/lib/validations/admin";
import { getAdminSession } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string; trimId: string }> };

// ─── PATCH /api/admin/vehicles/[id]/trims/[trimId] ──────
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { id, trimId } = await params;
    const body = await request.json();
    const parsed = trimUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.trim.findFirst({
      where: { id: trimId, vehicleId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "트림을 찾을 수 없습니다." }, { status: 404 });
    }

    if (parsed.data.isDefault) {
      await prisma.trim.updateMany({
        where: { vehicleId: id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const { specs, ...rest } = parsed.data;
    const trim = await prisma.trim.update({
      where: { id: trimId },
      data: {
        ...rest,
        ...(specs !== undefined && {
          specs: specs === null ? Prisma.JsonNull : specs,
        }),
      },
    });

    return NextResponse.json({ success: true, data: trim });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/[id]/trims/[trimId]]", error);
    return NextResponse.json(
      { error: "트림 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/vehicles/[id]/trims/[trimId] ─────
export async function DELETE(_request: NextRequest, { params }: Params) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { id, trimId } = await params;
    const existing = await prisma.trim.findFirst({
      where: { id: trimId, vehicleId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "트림을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.trim.delete({ where: { id: trimId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/vehicles/[id]/trims/[trimId]]", error);
    return NextResponse.json(
      { error: "트림 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
