import { renderToBuffer } from "@react-pdf/renderer";
import { QuoteDocument } from "./QuoteDocument";
import { ensureFontsRegistered } from "./fonts";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";

/**
 * 견적서 데이터를 react-pdf로 렌더링해 PDF 바이트로 반환한다.
 * 브라우저(Chrome) 의존이 없어 서버리스 환경에서 안정적으로 동작한다.
 */
export async function renderQuotePdfBuffer(
  data: PDFQuoteData
): Promise<Uint8Array<ArrayBuffer>> {
  ensureFontsRegistered();
  const buffer = await renderToBuffer(<QuoteDocument data={data} />);

  // NextResponse Blob(BlobPart) 호환을 위해 일반 ArrayBuffer 기반으로 복사해 반환.
  const ab = new ArrayBuffer(buffer.byteLength);
  const out = new Uint8Array(ab);
  out.set(buffer);
  return out;
}
