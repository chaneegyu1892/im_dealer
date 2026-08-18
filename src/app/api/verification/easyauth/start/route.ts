import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";
import { startEasyAuth } from "@/lib/codef/easyauth";
import { docTypesForCustomer } from "@/lib/codef/doc-types";
import { isCustomerType } from "@/constants/customer-types";
import { easyAuthRateLimit } from "@/lib/rate-limit";
import { easyAuthFieldsSchema, toEasyAuthInput } from "../validation";

// ─── POST /api/verification/easyauth/start ───────────────
// 회원 간편인증 1차 요청 → 휴대폰 푸시 발송 후 twoWayInfo(비-PII) 반환.
// 클라이언트는 twoWayInfo 와 입력값을 complete 에 다시 실어 보낸다(서버 무상태).
export async function POST(request: NextRequest) {
  // 로그인 필수 — 간편인증 요청(유료 Codef API)을 인증된 사용자만 허용.
  const { user, error: authError } = await requireActiveUser();
  if (authError) return authError;
  if (!user.supabaseId) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  // 발송 쿨다운 — 임의 번호로 인증 푸시를 반복 발송하는 스팸 차단.
  if (easyAuthRateLimit) {
    const { success } = await easyAuthRateLimit.limit(`easyauth:${user.supabaseId}`);
    if (!success) {
      return NextResponse.json(
        { error: "인증 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }
  }

  const parsed = easyAuthFieldsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }
  const fields = parsed.data;

  const verification = await prisma.customerVerification.findFirst({
    where: { id: fields.verificationId, userId: user.supabaseId },
  });
  if (!verification) {
    return NextResponse.json({ error: "해당 인증 레코드를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!isCustomerType(verification.customerType)) {
    return NextResponse.json({ error: "지원하지 않는 고객 유형입니다." }, { status: 400 });
  }
  if (!docTypesForCustomer(verification.customerType).includes(fields.docType)) {
    return NextResponse.json({ error: "해당 고객 유형에 허용되지 않은 문서입니다." }, { status: 400 });
  }

  // Codef 에 보내는 id 는 소유 검증을 통과한 레코드 id 로 서버가 결정한다.
  const result = await startEasyAuth(toEasyAuthInput({ ...fields, id: verification.id }));
  if (result.kind === "error") {
    // Codef 원문(PII 가능)·코드를 그대로 노출하지 않고 일반 메시지 + 코드만 반환
    console.error("[easyauth/start]", { code: result.code, docType: fields.docType });
    return NextResponse.json(
      { error: "간편인증 요청에 실패했습니다.", code: result.code },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, twoWayInfo: result.twoWayInfo });
}
