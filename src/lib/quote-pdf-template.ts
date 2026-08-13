import type { QuoteScenarioDetails, QuoteScenarioType } from "@/types/quote";

export const LEGACY_COMPARISON_NOTICE =
  "저장 당시 시나리오 비교값이 없어 선택 견적만 표시합니다. 비교 열은 현재 요율로 재계산하지 않습니다.";

// 견적서 PDF 데이터 타입. 실제 렌더링은 src/lib/pdf/QuoteDocument.tsx(react-pdf)에서 수행한다.

export interface PDFQuoteColor {
  name: string;
  hexCode: string;
  priceDelta: number;
}

export interface PDFQuoteData {
  vehicleName: string;
  vehicleBrand: string;
  trimName: string;
  trimPrice: number;
  selectedOptions: Array<{ name: string; price: number }>;
  totalVehiclePrice: number;
  productType: string;
  contractMonths: number;
  annualMileage: number;
  contractType: string;
  scenarioType?: QuoteScenarioType;
  /** false 면 비교 3열을 그리지 않는다. 생략 시 비교표를 표시(기존 견적서). */
  comparisonFromSnapshot?: boolean;
  /** 견적 산출(저장) 시점 ISO 문자열. 재발급 시 '오늘 산출'로 보이지 않게 한다. 생략 시 렌더 시점. */
  issuedAt?: string;
  /** 견적 유효기간 ISO 문자열. 생략 시 산출일 + 5일. */
  validUntil?: string;
  scenarios: QuoteScenarioDetails;
  userEmail: string | null;
  exteriorColor?: PDFQuoteColor | null;
  interiorColor?: PDFQuoteColor | null;
}
