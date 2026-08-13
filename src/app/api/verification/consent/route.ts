import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";
import {
  hashVerificationCapability,
  matchesVerificationCapability,
  VERIFICATION_CAPABILITY_COOKIE_PATH,
  verificationCapabilityCookieName,
} from "@/lib/verification-capability";

const consentSchema = z.object({
  sessionId: z.string().min(1),
  customerType: z.enum(["individual", "self_employed", "corporate", "nonprofit"]),
  consentedAt: z.string().datetime(),
});

// ─── POST /api/verification/consent ──────────────────────
// 고객 동의 수신 및 CustomerVerification 레코드 생성
export async function POST(request: NextRequest) {
  // 로그인 필수
  const { user, error: authError } = await requireActiveUser();
  if (authError) return authError;
  if (!user.supabaseId) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 403 });
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
    const quote = await prisma.savedQuote.findUnique({
      where: { sessionId },
      select: {
        id: true,
        userId: true,
        customerType: true,
        deletedAt: true,
        expiresAt: true,
        verificationCapabilityHash: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "저장된 견적을 찾을 수 없습니다." }, { status: 404 });
    }
    if (quote.deletedAt || quote.expiresAt <= new Date()) {
      return NextResponse.json({ error: "만료되었거나 삭제된 견적입니다." }, { status: 410 });
    }
    if (quote.customerType !== customerType) {
      return NextResponse.json(
        { error: "견적의 고객 유형과 일치하지 않습니다." },
        { status: 409 }
      );
    }

    let clearCapabilityCookie = false;
    if (quote.userId !== user.supabaseId) {
      if (quote.userId !== null) {
        return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
      }

      const cookieName = verificationCapabilityCookieName(sessionId);
      const capability = (await cookies()).get(cookieName)?.value;
      if (!capability || !matchesVerificationCapability(quote.verificationCapabilityHash, capability)) {
        return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
      }

      // 최초 로그인 시, 같은 브라우저에서 받은 capability 를 제시한 사용자만 견적을 원자적으로 소유한다.
      const claimed = await prisma.savedQuote.updateMany({
        where: {
          id: quote.id,
          userId: null,
          deletedAt: null,
          expiresAt: { gt: new Date() },
          verificationCapabilityHash: hashVerificationCapability(capability),
        },
        data: {
          userId: user.supabaseId,
          verificationCapabilityHash: null,
        },
      });
      if (claimed.count === 0) {
        return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
      }
      clearCapabilityCookie = true;
    }

    const record = await prisma.customerVerification.upsert({
      where: { sessionId_userId: { sessionId, userId: user.supabaseId } },
      create: {
        sessionId,
        userId: user.supabaseId,
        customerType,
        consentedAt: new Date(consentedAt),
      },
      update: {
        consentedAt: new Date(consentedAt),
      },
    });

    const response = NextResponse.json(
      { success: true, data: { verificationId: record.id } },
      { status: 201 }
    );
    if (clearCapabilityCookie) {
      response.cookies.set({
        name: verificationCapabilityCookieName(sessionId),
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: VERIFICATION_CAPABILITY_COOKIE_PATH,
        maxAge: 0,
        expires: new Date(0),
      });
    }
    return response;
  } catch (error) {
    console.error("[POST /api/verification/consent]", error);
    return NextResponse.json(
      { error: "동의 정보 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
