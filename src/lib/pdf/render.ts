/**
 * Puppeteer 기반 HTML → PDF 바이트 렌더러.
 * 고객용/어드민용 PDF 라우트가 공유한다.
 * NextResponse 본문 타입과 호환되도록 Uint8Array로 반환.
 */
export async function renderHtmlToPdfBuffer(html: string): Promise<Uint8Array<ArrayBuffer>> {
  const puppeteer = (await import("puppeteer")).default;

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
    await new Promise((r) => setTimeout(r, 300));

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // BlobPart 호환을 위해 일반 ArrayBuffer 위에 새 Uint8Array<ArrayBuffer>를 만들어 반환.
    const ab = new ArrayBuffer(pdf.byteLength);
    const out = new Uint8Array(ab);
    out.set(pdf);
    return out;
  } finally {
    await browser.close();
  }
}
