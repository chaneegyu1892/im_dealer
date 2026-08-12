import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import {
  toVerificationDetailView,
  verificationDetailSelect,
} from "@/lib/verification-view";

// ─── GET /api/verification/[id] ──────────────────────────
// 관리자용: verificationId로 UI에 필요한 최소 인증 결과 조회
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireRoleAtLeast("staff");
  if (authError) return authError;

  try {
    const { id } = await params;

    const record = await prisma.customerVerification.findUnique({
      where: { id },
      select: verificationDetailSelect,
    });

    if (!record) {
      return NextResponse.json(
        { error: "해당 인증 레코드를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: toVerificationDetailView(record),
    });
  } catch (error) {
    console.error("[GET /api/verification/[id]]", error);
    return NextResponse.json(
      { error: "인증 결과 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
