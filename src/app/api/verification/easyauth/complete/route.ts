import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";
import { completeEasyAuth } from "@/lib/codef/easyauth";
import { docTypesForCustomer } from "@/lib/codef/doc-types";
import { isCustomerType } from "@/constants/customer-types";
import { encryptPII, encryptString } from "@/lib/pii";
import { easyAuthFieldsSchema, twoWayInfoSchema, toEasyAuthInput } from "../validation";

const SAFE_FAILURE_CATEGORIES: Readonly<Record<string, string>> = {
  "CF-12872": "AUTH_NOT_COMPLETED",
  "CF-03002": "AUTH_PENDING",
};

function storedFailureCategory(code: string | undefined): string {
  return (code && SAFE_FAILURE_CATEGORIES[code]) || "PROVIDER_ERROR";
}

// ─── POST /api/verification/easyauth/complete ────────────
// 사용자 간편인증 완료 후 2차 요청 → 원본 PDF 수신 → AES-256-GCM 암호화 저장.
// 원본/PII 는 클라이언트에 노출하지 않고 처리 상태만 반환한다.
export async function POST(request: NextRequest) {
  // 로그인 필수 — PII(원본 PDF) 저장을 인증된 사용자만 허용.
  const { user, error: authError } = await requireActiveUser();
  if (authError) return authError;
  if (!user.supabaseId) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 403 });
  }

  const schema = easyAuthFieldsSchema.extend({ twoWayInfo: twoWayInfoSchema });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }
  const { twoWayInfo, ...fields } = parsed.data;

  const verification = await prisma.customerVerification.findFirst({
    where: { id: fields.verificationId, userId: user.supabaseId },
    select: { id: true, customerType: true },
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

  const issued = await completeEasyAuth(toEasyAuthInput(fields), twoWayInfo);

  const data = {
    verificationId: fields.verificationId,
    docType: fields.docType,
    status: issued.success ? "issued" : "failed",
    fileName: issued.success ? `${fields.docType}.pdf` : null,
    mimeType: "application/pdf",
    contentEnc: issued.pdfBase64
      ? (encryptPII(issued.pdfBase64) as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    docVerifyNo: encryptString(issued.docVerifyNo),
    // 공급자 메시지는 이름·식별자·응답 조각을 포함할 수 있어 저장하지 않는다.
    // 운영에는 짧은 allowlist 범주만 남기고, 상세 오류는 공급자 측 추적을 사용한다.
    failReason: issued.success ? null : storedFailureCategory(issued.code),
    issuedAt: issued.success ? new Date() : null,
    // 과거에 purge된 행을 재시도해도 새 내용이 다음 retention 주기에 다시 선택되게 한다.
    piiPurgedAt: null,
  };

  // 동일 (verificationId, docType) 재시도 시 갱신, 없으면 생성.
  const existing = await prisma.verificationDocument.findFirst({
    where: { verificationId: fields.verificationId, docType: fields.docType },
    select: { id: true },
  });
  if (existing) {
    await prisma.verificationDocument.update({ where: { id: existing.id }, data });
  } else {
    await prisma.verificationDocument.create({ data });
  }

  if (!issued.success) {
    console.error("[easyauth/complete]", { code: issued.code, docType: fields.docType });
    return NextResponse.json(
      { success: false, docType: fields.docType, code: issued.code },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, docType: fields.docType });
}
