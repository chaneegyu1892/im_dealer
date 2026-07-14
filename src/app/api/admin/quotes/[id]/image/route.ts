import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import { renderQuoteImageBuffer } from "@/lib/quote-image/render-quote-image";
import {
  buildVehicleScenarios,
  type ContractTypeKor,
  type SelectedOptionSnapshot,
} from "@/lib/quote-scenarios";

export const runtime = "nodejs";
export const maxDuration = 30;

function isContractTypeKor(value: unknown): value is ContractTypeKor {
  return value === "인수형" || value === "반납형";
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function pickSavedSelectedOptions(value: unknown): SelectedOptionSnapshot[] | null {
  if (!Array.isArray(value)) return null;
  const result: SelectedOptionSnapshot[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string") continue;
    if (typeof o.name !== "string") continue;
    if (typeof o.price !== "number") continue;
    result.push({ id: o.id, name: o.name, price: o.price });
  }
  return result;
}

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

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: quote.vehicleId },
    select: { slug: true },
  });
  if (!vehicle) {
    return NextResponse.json(
      { error: "견적에 연결된 차량을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const breakdown =
    quote.breakdown && typeof quote.breakdown === "object"
      ? (quote.breakdown as Record<string, unknown>)
      : {};
  const selectedOptionIds = pickStringArray(breakdown.selectedOptionIds);
  const savedOptions = pickSavedSelectedOptions(breakdown.selectedOptions);
  const productType =
    typeof breakdown.productType === "string" ? breakdown.productType : "장기렌트";

  const contractType: ContractTypeKor = isContractTypeKor(quote.contractType)
    ? quote.contractType
    : "반납형";

  const outcome = await buildVehicleScenarios({
    vehicleSlugOrId: vehicle.slug,
    trimId: quote.trimId,
    selectedOptionIds,
    contractMonths: quote.contractMonths,
    annualMileage: quote.annualMileage,
    contractType,
    exteriorColorId: quote.exteriorColorId,
    interiorColorId: quote.interiorColorId,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error.error }, { status: outcome.error.status });
  }

  const imageSelectedOptions = (savedOptions && savedOptions.length > 0
    ? savedOptions
    : outcome.data.selectedOptions
  ).map((o) => ({ name: o.name, price: o.price }));

  const customerLabel = [quote.customerName, quote.phone].filter(Boolean).join(" / ");
  const userEmail = customerLabel
    ? `${customerLabel} (어드민 재발급: ${admin.email ?? admin.id})`
    : `어드민 재발급: ${admin.email ?? admin.id}`;

  const imageData: PDFQuoteData = {
    vehicleName: outcome.data.vehicleName,
    vehicleBrand: outcome.data.vehicleBrand,
    trimName: outcome.data.trimName,
    trimPrice: outcome.data.trimPrice,
    selectedOptions: imageSelectedOptions,
    totalVehiclePrice: outcome.data.totalVehiclePrice,
    productType,
    contractMonths: quote.contractMonths,
    annualMileage: quote.annualMileage,
    contractType,
    scenarios: outcome.data.scenarios,
    userEmail,
    exteriorColor: outcome.data.exteriorColor
      ? {
          name: outcome.data.exteriorColor.name,
          hexCode: outcome.data.exteriorColor.hexCode,
          priceDelta: outcome.data.exteriorColor.priceDelta,
        }
      : null,
    interiorColor: outcome.data.interiorColor
      ? {
          name: outcome.data.interiorColor.name,
          hexCode: outcome.data.interiorColor.hexCode,
          priceDelta: outcome.data.interiorColor.priceDelta,
        }
      : null,
  };

  try {
    const imageBuffer = await renderQuoteImageBuffer(imageData);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const vehicleNameSafe = imageData.vehicleName.replace(/[^\wㄱ-힣]/g, "_");
    const idSuffix = quote.id.slice(0, 6);
    const filename = `아임딜러_견적서_${vehicleNameSafe}_${today}_${idSuffix}.png`;

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
