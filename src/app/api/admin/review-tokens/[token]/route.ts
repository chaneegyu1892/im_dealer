import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  const { token } = await params;

  try {
    const existing = await prisma.reviewRequestToken.findUnique({
      where: { token },
      select: { id: true, usedAt: true, revokedAt: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "토큰을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (existing.usedAt) {
      return NextResponse.json(
        { error: "이미 사용된 링크는 무효화할 수 없습니다." },
        { status: 400 }
      );
    }

    if (existing.revokedAt) {
      return NextResponse.json(
        { error: "이미 무효화된 링크입니다." },
        { status: 400 }
      );
    }

    const updated = await prisma.reviewRequestToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "REVIEW_TOKEN_REVOKE",
      resource: "ReviewRequestToken",
      targetId: updated.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/review-tokens/[token]]", error);
    return NextResponse.json(
      { error: "토큰 무효화 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
