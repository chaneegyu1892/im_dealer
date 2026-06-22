import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { decryptDocumentContent } from "@/lib/pii";

// ─── GET /api/verification/documents/[docId] ─────────────
// 관리자 전용: 저장된 공문서(PDF)를 복호화해 다운로드로 스트리밍.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { docId } = await params;
  const doc = await prisma.verificationDocument.findUnique({ where: { id: docId } });

  if (!doc || !doc.contentEnc) {
    return NextResponse.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  }

  let base64: string | null;
  try {
    base64 = decryptDocumentContent(doc.contentEnc);
  } catch {
    return NextResponse.json({ error: "문서 복호화에 실패했습니다." }, { status: 500 });
  }
  if (!base64) {
    return NextResponse.json({ error: "문서 원본이 없습니다." }, { status: 404 });
  }

  const buf = new Uint8Array(Buffer.from(base64, "base64"));
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType ?? "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.fileName ?? "document.pdf"}"`,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
