import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminLike } from "@/lib/require-admin";

const MEMO_CATEGORIES = ["이슈/긴급", "공지사항", "일반", "업무/인수인계"] as const;

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  category: z.enum(MEMO_CATEGORIES).optional(),
  isPinned: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { admin, error } = await requireAdminLike();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const before = await prisma.operationalNote.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
    }

    const updated = await prisma.operationalNote.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[PATCH /api/admin/memos/[id]]", err);
    return NextResponse.json(
      { error: "메모 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminLike();
  if (error) return error;

  try {
    const { id } = await params;
    const before = await prisma.operationalNote.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
    }

    await prisma.operationalNote.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/memos/[id]]", err);
    return NextResponse.json(
      { error: "메모 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
