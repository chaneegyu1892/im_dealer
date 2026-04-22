import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuotePDFHtml, type PDFQuoteData } from "@/lib/quote-pdf-template";

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
  };

  const html = generateQuotePDFHtml(pdfData);

  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    return NextResponse.json({ error: "PDF 생성 모듈을 불러올 수 없습니다." }, { status: 500 });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
    await new Promise((r) => setTimeout(r, 300));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const vehicleNameSafe = pdfData.vehicleName.replace(/[^\wㄱ-힣]/g, "_");
    const filename = `아임딜러_견적서_${vehicleNameSafe}_${today}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json(
      { error: `PDF 생성에 실패했습니다: ${message}` },
      { status: 500 }
    );
  } finally {
    await browser?.close();
  }
}
