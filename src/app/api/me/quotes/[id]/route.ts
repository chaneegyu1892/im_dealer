import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * 회원 본인 저장 견적 soft-delete.
 * SavedQuote.userId 는 Supabase auth user id 를 저장한다.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireActiveUser();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "잘못된 견적 ID입니다." }, { status: 400 });
  }

  const supabaseId = auth.user.supabaseId;
  if (!supabaseId) {
    return NextResponse.json({ error: "계정 연결 정보가 없습니다." }, { status: 403 });
  }

  const existing = await prisma.savedQuote.findFirst({
    where: { id, userId: supabaseId, deletedAt: null },
    select: { id: true },
  });

  if (!existing) {
    // 이미 삭제됐거나 소유가 아니면 동일하게 404 (존재 여부 누설 최소화)
    return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.savedQuote.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
