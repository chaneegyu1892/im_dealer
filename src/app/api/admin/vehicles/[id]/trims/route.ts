import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { trimCreateSchema } from "@/lib/validations/admin";

type Params = { params: Promise<{ id: string }> };

// ─── POST /api/admin/vehicles/[id]/trims ────────────────
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = trimCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    // isDefault가 true면 기존 기본 트림 해제
    if (parsed.data.isDefault) {
      await prisma.trim.updateMany({
        where: { vehicleId: id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const { specs, ...rest } = parsed.data;
    const trim = await prisma.trim.create({
      data: {
        ...rest,
        vehicleId: id,
        ...(specs !== undefined && {
          specs: specs === null ? Prisma.JsonNull : specs,
        }),
      },
    });

    return NextResponse.json({ success: true, data: trim }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/vehicles/[id]/trims]", error);
    return NextResponse.json(
      { error: "트림 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
