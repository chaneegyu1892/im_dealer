import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// ─── PATCH /api/admin/quotes/[id] ──────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const id = params.id;
    const body = await request.json();
    const { status, internalMemo } = body;

    const updated = await prisma.savedQuote.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(internalMemo !== undefined && { internalMemo }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/quotes/[id]]", error);
    return NextResponse.json(
      { error: "견적 정보를 업데이트하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/quotes/[id] ─────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const id = params.id;
    await prisma.savedQuote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/quotes/[id]]", error);
    return NextResponse.json(
      { error: "견적을 삭제하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
