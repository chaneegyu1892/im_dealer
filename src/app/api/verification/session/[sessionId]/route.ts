import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// ─── GET /api/verification/session/[sessionId] ───────────
// 관리자용: sessionId로 가장 최근 인증 결과 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { sessionId } = await params;

    const record = await prisma.customerVerification.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return NextResponse.json(
        { success: false, error: "서류 미제출" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("[GET /api/verification/session/[sessionId]]", error);
    return NextResponse.json(
      { success: false, error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
