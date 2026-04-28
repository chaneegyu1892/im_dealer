import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { notifyVerificationSubmitted } from "@/lib/notify";

const consentSchema = z.object({
  sessionId: z.string().min(1),
  customerType: z.enum(["individual", "self_employed", "corporate", "nonprofit"]),
  consentedAt: z.string().datetime(),
});

// ─── POST /api/verification/consent ──────────────────────
// 고객 동의 수신 및 CustomerVerification 레코드 생성
export async function POST(request: NextRequest) {
  // 로그인 필수
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

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

    void notifyVerificationSubmitted({ sessionId });

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
