declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  import type {
    DocumentInitParameters,
    PDFDocumentLoadingTask,
    PDFDocumentProxy,
    PDFPageProxy,
  } from "pdfjs-dist/types/src/display/api";

  export type { DocumentInitParameters, PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy };

  export function getDocument(src?: DocumentInitParameters): PDFDocumentLoadingTask;

  export const VerbosityLevel: {
    readonly ERRORS: number;
    readonly WARNINGS: number;
    readonly INFOS: number;
  };
}

declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {}
