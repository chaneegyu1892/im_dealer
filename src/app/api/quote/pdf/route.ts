import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import { renderQuotePdfBuffer } from "@/lib/pdf/render-quote";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: Partial<PDFQuoteData>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  if (!body.vehicleName || !body.scenarios) {
    return NextResponse.json({ error: "필수 견적 정보가 누락되었습니다." }, { status: 400 });
  }

  const pdfData: PDFQuoteData = {
    vehicleName: body.vehicleName,
    vehicleBrand: body.vehicleBrand ?? "",
    trimName: body.trimName ?? "",
    trimPrice: body.trimPrice ?? 0,
    selectedOptions: body.selectedOptions ?? [],
    totalVehiclePrice: body.totalVehiclePrice ?? body.trimPrice ?? 0,
    productType: body.productType ?? "장기렌트",
    contractMonths: body.contractMonths ?? 48,
    annualMileage: body.annualMileage ?? 20000,
    contractType: body.contractType ?? "반납형",
    scenarios: body.scenarios,
    userEmail: user.email ?? "이메일 미등록",
    exteriorColor: body.exteriorColor ?? null,
    interiorColor: body.interiorColor ?? null,
  };

  try {
    const pdfBuffer = await renderQuotePdfBuffer(pdfData);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const vehicleNameSafe = pdfData.vehicleName.replace(/[^\wㄱ-힣]/g, "_");
    const filename = `아임딜러_견적서_${vehicleNameSafe}_${today}.pdf`;

    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": pdfBuffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `PDF 생성에 실패했습니다: ${message}` },
      { status: 500 }
    );
  }
}
