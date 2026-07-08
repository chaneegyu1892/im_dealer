import {
  DOMMatrix,
  ImageData,
  Path2D,
  createCanvas,
  type Canvas,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import type { PDFDocumentLoadingTask } from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist/types/src/pdf";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import { renderQuotePdfBuffer } from "@/lib/pdf/render-quote";

const PDF_POINTS_PER_INCH = 72;
const RENDER_DPI = 150;
const VIEWPORT_SCALE = RENDER_DPI / PDF_POINTS_PER_INCH;
const FIRST_PAGE = 1;

class QuoteImageRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteImageRenderError";
  }
}

type CanvasEntry = {
  readonly canvas: Canvas;
  readonly context: SKRSContext2D;
};
type NativeRenderTask = {
  readonly promise: Promise<void>;
};
type NativePdfPage = {
  readonly cleanup: () => void;
  readonly getViewport: (params: { readonly scale: number }) => PageViewport;
  readonly render: (params: {
    readonly canvas: Canvas;
    readonly canvasContext: SKRSContext2D;
    readonly viewport: PageViewport;
  }) => NativeRenderTask;
};

type PdfJsLegacy = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

class NapiCanvasFactory {
  create(width: number, height: number): CanvasEntry {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(entry: CanvasEntry, width: number, height: number): void {
    entry.canvas.width = width;
    entry.canvas.height = height;
  }

  destroy(entry: CanvasEntry): void {
    entry.canvas.width = 0;
    entry.canvas.height = 0;
  }
}

function installCanvasGlobals(): void {
  Object.defineProperties(globalThis, {
    DOMMatrix: { configurable: true, value: DOMMatrix, writable: true },
    ImageData: { configurable: true, value: ImageData, writable: true },
    Path2D: { configurable: true, value: Path2D, writable: true },
  });
}

function toPixelDimension(value: number): number {
  return Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNativePdfPage(value: unknown): value is NativePdfPage {
  return (
    isRecord(value) &&
    typeof value.cleanup === "function" &&
    typeof value.getViewport === "function" &&
    typeof value.render === "function"
  );
}

async function loadPdfJsLegacy(): Promise<PdfJsLegacy> {
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

async function convertPdfToPng(pdfBuffer: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  installCanvasGlobals();
  const canvasFactory = new NapiCanvasFactory();
  let loadingTask: PDFDocumentLoadingTask | null = null;

  try {
    const { getDocument, VerbosityLevel } = await loadPdfJsLegacy();
    loadingTask = getDocument({
      CanvasFactory: NapiCanvasFactory,
      data: pdfBuffer,
      verbosity: VerbosityLevel.ERRORS,
    });
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(FIRST_PAGE);
    if (!isNativePdfPage(page)) {
      throw new QuoteImageRenderError("PDF 첫 페이지 렌더러를 초기화하지 못했습니다.");
    }

    const viewport = page.getViewport({ scale: VIEWPORT_SCALE });
    const entry = canvasFactory.create(
      toPixelDimension(viewport.width),
      toPixelDimension(viewport.height)
    );

    try {
      await page.render({
        canvas: entry.canvas,
        canvasContext: entry.context,
        viewport,
      }).promise;

      const pngBuffer = entry.canvas.toBuffer("image/png");
      const ab = new ArrayBuffer(pngBuffer.byteLength);
      const out = new Uint8Array(ab);
      out.set(pngBuffer);
      return out;
    } finally {
      page.cleanup();
      canvasFactory.destroy(entry);
    }
  } catch (err) {
    if (err instanceof QuoteImageRenderError) throw err;
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    throw new QuoteImageRenderError(`PDF 이미지 변환에 실패했습니다: ${message}`);
  } finally {
    if (loadingTask) {
      await loadingTask.destroy();
    }
  }
}

export async function renderQuoteImageBuffer(
  data: PDFQuoteData
): Promise<Uint8Array<ArrayBuffer>> {
  const pdfBuffer = await renderQuotePdfBuffer(data);
  return convertPdfToPng(pdfBuffer);
}
