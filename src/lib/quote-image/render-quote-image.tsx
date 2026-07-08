import fs from "node:fs";
import path from "node:path";
import { unstable_createNodejsStream } from "next/dist/compiled/@vercel/og/index.node";
import type { ImageResponseNodeOptions } from "next/dist/compiled/@vercel/og/types";
import { getBrandLogoDataUri } from "@/lib/pdf/brand-logo";
import { resolveFinanceLogos } from "@/lib/pdf/finance-logos";
import type { QuoteDocumentData } from "@/lib/quote-document-template";
import { QuoteImage, QUOTE_IMAGE_HEIGHT, QUOTE_IMAGE_WIDTH } from "./QuoteImage";

type QuoteImageFont = NonNullable<ImageResponseNodeOptions["fonts"]>[number];

let cachedFonts: QuoteImageFont[] | null = null;

function fontPath(file: string): string {
  return path.join(process.cwd(), "src/lib/pdf/fonts", file);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const out = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(out).set(buffer);
  return out;
}

function loadFonts(): QuoteImageFont[] {
  if (cachedFonts) return cachedFonts;

  cachedFonts = [
    { name: "Pretendard", data: toArrayBuffer(fs.readFileSync(fontPath("Pretendard-Regular.ttf"))), weight: 400, style: "normal" },
    { name: "Pretendard", data: toArrayBuffer(fs.readFileSync(fontPath("Pretendard-Medium.ttf"))), weight: 500, style: "normal" },
    { name: "Pretendard", data: toArrayBuffer(fs.readFileSync(fontPath("Pretendard-SemiBold.ttf"))), weight: 600, style: "normal" },
    { name: "Pretendard", data: toArrayBuffer(fs.readFileSync(fontPath("Pretendard-Bold.ttf"))), weight: 700, style: "normal" },
  ];
  return cachedFonts;
}

function toUint8Array(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const ab = new ArrayBuffer(buffer.byteLength);
  const out = new Uint8Array(ab);
  out.set(buffer);
  return out;
}

export async function renderQuoteImageBuffer(
  data: QuoteDocumentData
): Promise<Uint8Array<ArrayBuffer>> {
  const financeLogos = await resolveFinanceLogos([
    data.scenarios.conservative.bestFinanceCompany,
    data.scenarios.standard.bestFinanceCompany,
    data.scenarios.aggressive.bestFinanceCompany,
  ]);

  const stream = await unstable_createNodejsStream(
    <QuoteImage
      data={data}
      financeLogos={financeLogos}
      brandLogo={getBrandLogoDataUri()}
    />,
    {
      width: QUOTE_IMAGE_WIDTH,
      height: QUOTE_IMAGE_HEIGHT,
      fonts: loadFonts(),
    }
  );

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
    } else if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      throw new TypeError("Unexpected quote image stream chunk.");
    }
  }

  return toUint8Array(Buffer.concat(chunks));
}
