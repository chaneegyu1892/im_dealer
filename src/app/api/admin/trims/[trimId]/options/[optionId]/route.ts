import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { optionUpdateSchema } from "@/lib/validations/admin";

type Params = { params: Promise<{ trimId: string; optionId: string }> };

// ─── PATCH /api/admin/trims/[trimId]/options/[optionId] ──
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { trimId, optionId } = await params;
    const body = await request.json();
    const parsed = optionUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.trimOption.findFirst({
      where: { id: optionId, trimId },
    });
    if (!existing) {
      return NextResponse.json({ error: "옵션을 찾을 수 없습니다." }, { status: 404 });
    }

    const option = await prisma.trimOption.update({
      where: { id: optionId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: option });
  } catch (error) {
    console.error("[PATCH /api/admin/trims/[trimId]/options/[optionId]]", error);
    return NextResponse.json(
      { error: "옵션 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/trims/[trimId]/options/[optionId] ─
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { trimId, optionId } = await params;
    const existing = await prisma.trimOption.findFirst({
      where: { id: optionId, trimId },
    });
    if (!existing) {
      return NextResponse.json({ error: "옵션을 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.trimOption.delete({ where: { id: optionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/trims/[trimId]/options/[optionId]]", error);
    return NextResponse.json(
      { error: "옵션 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
