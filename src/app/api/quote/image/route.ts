import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";
import { renderQuoteImageBuffer } from "@/lib/quote-image/render-quote-image";
import { strictRateLimit, checkRateLimit } from "@/lib/rate-limit";
import { buildOfficialDeliveryImageData } from "@/lib/quote-delivery/official-image";

export const runtime = "nodejs";
export const maxDuration = 30;

const imageMetadataSchema = z.object({
  savedQuoteId: z.string().trim().min(1).max(200),
  sessionId: z.string().trim().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const limited = await checkRateLimit(req, strictRateLimit);
  if (limited) return limited;

  const { user, error: authError } = await requireActiveUser();
  if (authError) return authError;
  if (!user.supabaseId) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const metadataResult = imageMetadataSchema.safeParse(body);
  if (!metadataResult.success) {
    return NextResponse.json({ error: "저장된 견적 정보가 필요합니다." }, { status: 400 });
  }

  const savedQuote = await prisma.savedQuote.findFirst({
    where: {
      id: metadataResult.data.savedQuoteId,
      sessionId: metadataResult.data.sessionId,
      userId: user.supabaseId,
      deletedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      vehicleId: true,
      trimId: true,
      contractMonths: true,
      annualMileage: true,
      depositRate: true,
      prepayRate: true,
      contractType: true,
      monthlyPayment: true,
      pricingStatus: true,
      breakdown: true,
      exteriorColorId: true,
      interiorColorId: true,
    },
  });
  if (!savedQuote) {
    return NextResponse.json({ error: "다운로드할 견적을 확인할 수 없습니다." }, { status: 403 });
  }

  const imageResult = await buildOfficialDeliveryImageData(savedQuote);
  if (!imageResult.ok) {
    return NextResponse.json(
      { error: imageResult.error.error },
      { status: imageResult.error.status }
    );
  }
  const imageData = { ...imageResult.data, userEmail: user.email ?? "이메일 미등록" };

  try {
    const imageBuffer = await renderQuoteImageBuffer(imageData);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const vehicleNameSafe = imageData.vehicleName.replace(/[^\wㄱ-힣]/g, "_");
    const filename = `아임딜러_견적서_${vehicleNameSafe}_${today}.png`;

    const blob = new Blob([imageBuffer], { type: "image/png" });
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": imageBuffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `이미지 생성에 실패했습니다: ${message}` },
      { status: 500 }
    );
  }
}
