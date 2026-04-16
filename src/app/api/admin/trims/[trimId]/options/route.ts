import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { optionCreateSchema } from "@/lib/validations/admin";
import { getAdminSession } from "@/lib/admin-auth";

type Params = { params: Promise<{ trimId: string }> };

// ─── POST /api/admin/trims/[trimId]/options ─────────────
export async function POST(request: NextRequest, { params }: Params) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { trimId } = await params;
    const body = await request.json();
    const parsed = optionCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const trim = await prisma.trim.findUnique({ where: { id: trimId } });
    if (!trim) {
      return NextResponse.json({ error: "트림을 찾을 수 없습니다." }, { status: 404 });
    }

    const option = await prisma.trimOption.create({
      data: { ...parsed.data, trimId },
    });

    return NextResponse.json({ success: true, data: option }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/trims/[trimId]/options]", error);
    return NextResponse.json(
      { error: "옵션 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
