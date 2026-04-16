import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const consentSchema = z.object({
  sessionId: z.string().min(1),
  customerType: z.enum(["individual", "self_employed", "corporate"]),
  consentedAt: z.string().datetime(),
});

// ─── POST /api/verification/consent ──────────────────────
// 고객 동의 수신 및 CustomerVerification 레코드 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = consentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, customerType, consentedAt } = parsed.data;

    const record = await prisma.customerVerification.create({
      data: {
        sessionId,
        customerType,
        consentedAt: new Date(consentedAt),
      },
    });

    return NextResponse.json(
      { success: true, data: { verificationId: record.id } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/verification/consent]", error);
    return NextResponse.json(
      { error: "동의 정보 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
