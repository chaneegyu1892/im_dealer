import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { completeEasyAuth } from "@/lib/codef/easyauth";
import { encryptPII, encryptString } from "@/lib/pii";
import { easyAuthFieldsSchema, twoWayInfoSchema, toEasyAuthInput } from "../validation";

// ─── POST /api/verification/easyauth/complete ────────────
// 사용자 간편인증 완료 후 2차 요청 → 원본 PDF 수신 → AES-256-GCM 암호화 저장.
// 원본/PII 는 클라이언트에 노출하지 않고 처리 상태만 반환한다.
export async function POST(request: NextRequest) {
  // 로그인 필수 — PII(원본 PDF) 저장을 인증된 사용자만 허용.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const schema = easyAuthFieldsSchema.extend({ twoWayInfo: twoWayInfoSchema });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값이 올바르지 않습니다." }, { status: 400 });
  }
  const { twoWayInfo, ...fields } = parsed.data;

  const verification = await prisma.customerVerification.findUnique({
    where: { id: fields.verificationId },
    select: { id: true },
  });
  if (!verification) {
    return NextResponse.json({ error: "해당 인증 레코드를 찾을 수 없습니다." }, { status: 404 });
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
    failReason: issued.success ? null : (issued.error ?? issued.code ?? null),
    issuedAt: issued.success ? new Date() : null,
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
