// 어드민 견적서 재발급 — 카카오 전송 견적서와 동일한 공용 빌더로 이미지를 생성한다.
// 빌더가 상품 유형(장기렌트/리스)별 요율을 정확히 고르고, 최종 금액과 시나리오
// 비교 값을 저장 시점 스냅샷으로 고정하므로 "고객이 받은 견적"이 그대로 재현된다.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { buildOfficialDeliveryImageData } from "@/lib/quote-delivery/official-image";
import { renderQuoteImageBuffer } from "@/lib/quote-image/render-quote-image";
import { buildQuoteImageFilename } from "@/lib/quote-image/quote-image-filename";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  const quote = await prisma.savedQuote.findFirst({
    where: { id, deletedAt: null },
  });
  if (!quote) {
    return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });
  }
  if (quote.pricingStatus === "CONSULTATION_REQUIRED") {
    return NextResponse.json(
      { error: "자동 견적 데이터가 없어 견적서 이미지를 생성할 수 없습니다." },
      { status: 409 }
    );
  }

  const imageResult = await buildOfficialDeliveryImageData(quote);
  if (!imageResult.ok) {
    return NextResponse.json(
      { error: imageResult.error.error },
      { status: imageResult.error.status }
    );
  }

  const customerLabel = [quote.customerName, quote.phone].filter(Boolean).join(" / ");
  const userEmail = customerLabel
    ? `${customerLabel} (어드민 재발급: ${admin.email ?? admin.id})`
    : `어드민 재발급: ${admin.email ?? admin.id}`;
  const imageData = { ...imageResult.data, userEmail };

  try {
    const imageBuffer = await renderQuoteImageBuffer(imageData);

    const filename = buildQuoteImageFilename({
      vehicleName: imageData.vehicleName,
      idSuffix: quote.id.slice(0, 6),
      customerName: quote.customerName,
    });

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
    console.error("[admin quote image] failed", err);
    return NextResponse.json(
      { error: `이미지 생성에 실패했습니다: ${message}` },
      { status: 500 }
    );
  }
}
