import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { startEasyAuth } from "@/lib/codef/easyauth";
import { docTypesForCustomer } from "@/lib/codef/doc-types";
import { isCustomerType } from "@/constants/customer-types";
import { easyAuthFieldsSchema, toEasyAuthInput } from "../validation";

// ─── POST /api/verification/easyauth/start ───────────────
// 회원 간편인증 1차 요청 → 휴대폰 푸시 발송 후 twoWayInfo(비-PII) 반환.
// 클라이언트는 twoWayInfo 와 입력값을 complete 에 다시 실어 보낸다(서버 무상태).
export async function POST(request: NextRequest) {
  // 로그인 필수 — 간편인증 요청(유료 Codef API)을 인증된 사용자만 허용.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = easyAuthFieldsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }
  const fields = parsed.data;

  const verification = await prisma.customerVerification.findUnique({
    where: { id: fields.verificationId },
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

  const result = await startEasyAuth(toEasyAuthInput(fields));
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
