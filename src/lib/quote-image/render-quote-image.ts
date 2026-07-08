import { pdfToPng, VerbosityLevel } from "pdf-to-png-converter";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import { renderQuotePdfBuffer } from "@/lib/pdf/render-quote";

const PDF_POINTS_PER_INCH = 72;
const RENDER_DPI = 150;
const VIEWPORT_SCALE = RENDER_DPI / PDF_POINTS_PER_INCH;

class QuoteImageRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteImageRenderError";
  }
}

async function convertPdfToPng(pdfBuffer: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const pages = await pdfToPng(pdfBuffer, {
      pagesToProcess: [1],
      viewportScale: VIEWPORT_SCALE,
      returnPageContent: true,
      verbosityLevel: VerbosityLevel.ERRORS,
    });
    const firstPage = pages[0];
    if (!firstPage?.content) {
      throw new QuoteImageRenderError("PDF 첫 페이지 이미지가 생성되지 않았습니다.");
    }

    const pngBuffer = firstPage.content;
    const ab = new ArrayBuffer(pngBuffer.byteLength);
    const out = new Uint8Array(ab);
    out.set(pngBuffer);
    return out;
  } catch (err) {
    if (err instanceof QuoteImageRenderError) throw err;
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    throw new QuoteImageRenderError(`PDF 이미지 변환에 실패했습니다: ${message}`);
  }
}

export async function renderQuoteImageBuffer(
  data: PDFQuoteData
): Promise<Uint8Array<ArrayBuffer>> {
  const pdfBuffer = await renderQuotePdfBuffer(data);
  return convertPdfToPng(pdfBuffer);
}
