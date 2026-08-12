import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import {
  toVerificationDetailView,
  verificationDetailWithDocumentsSelect,
} from "@/lib/verification-view";
import { logAdminAction } from "@/lib/audit";

// ─── GET /api/verification/session/[sessionId] ───────────
// 관리자용: 견적 소유자와 결속된 sessionId의 가장 최근 인증 결과 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { admin, error: authError } = await requireRoleAtLeast("staff");
  if (authError) return authError;

  try {
    const { sessionId } = await params;

    const quote = await prisma.savedQuote.findUnique({
      where: { sessionId },
      select: { userId: true },
    });
    if (!quote?.userId) {
      return NextResponse.json(
        { success: false, error: "서류 미제출" },
        { status: 404 }
      );
    }

    const record = await prisma.customerVerification.findFirst({
      where: { sessionId, userId: quote.userId },
      orderBy: { createdAt: "desc" },
      select: verificationDetailWithDocumentsSelect,
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: "서류 미제출" },
        { status: 404 }
      );
    }

    const data = toVerificationDetailView(record);
    await logAdminAction({
      request,
      actor: admin,
      action: "VERIFICATION_DETAIL_VIEW",
      resource: "CustomerVerification",
      targetId: record.id,
      meta: {
        verificationId: record.id,
        sessionId,
      },
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[GET /api/verification/session/[sessionId]]", error);
    return NextResponse.json(
      { success: false, error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
