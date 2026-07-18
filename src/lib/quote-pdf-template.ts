import type { QuoteScenarioDetails, QuoteScenarioType } from "@/types/quote";

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
  scenarios: QuoteScenarioDetails;
  userEmail: string;
  exteriorColor?: PDFQuoteColor | null;
  interiorColor?: PDFQuoteColor | null;
}
