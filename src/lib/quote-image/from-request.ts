// 클라이언트가 보낸 부분 견적 페이로드를 렌더러가 요구하는 PDFQuoteData 로 정규화한다.
// /api/quote/image(다운로드)와 /api/quote/deliver(카톡 전송)가 동일한 견적서를 만들도록 공유한다.

import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import { parseQuoteScenarioType } from "@/lib/quote-scenario-selection";

export function buildQuoteImageData(
  body: Partial<PDFQuoteData>,
  userEmail: string | null
): PDFQuoteData {
  if (!body.vehicleName || !body.scenarios) {
    throw new Error("필수 견적 정보가 누락되었습니다.");
  }

  return {
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
    scenarioType: parseQuoteScenarioType(body.scenarioType),
    scenarios: body.scenarios,
    userEmail: userEmail ?? "이메일 미등록",
    exteriorColor: body.exteriorColor ?? null,
    interiorColor: body.interiorColor ?? null,
  };
}
