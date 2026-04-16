import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

// ─── GET /api/verification/[id] ──────────────────────────
// 관리자용: verificationId로 전체 인증 결과 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;

    const record = await prisma.customerVerification.findUnique({
      where: { id },
    });

    if (!record) {
      return NextResponse.json(
        { error: "해당 인증 레코드를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error("[GET /api/verification/[id]]", error);
    return NextResponse.json(
      { error: "인증 결과 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
