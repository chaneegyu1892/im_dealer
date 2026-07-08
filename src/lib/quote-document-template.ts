import type { QuoteScenarioDetails } from "@/types/quote";

export interface QuoteDocumentColor {
  readonly name: string;
  readonly hexCode: string;
  readonly priceDelta: number;
}

export interface QuoteDocumentData {
  readonly vehicleName: string;
  readonly vehicleBrand: string;
  readonly trimName: string;
  readonly trimPrice: number;
  readonly selectedOptions: readonly { readonly name: string; readonly price: number }[];
  readonly totalVehiclePrice: number;
  readonly productType: string;
  readonly contractMonths: number;
  readonly annualMileage: number;
  readonly contractType: string;
  readonly scenarios: QuoteScenarioDetails;
  readonly userEmail: string;
  readonly exteriorColor?: QuoteDocumentColor | null;
  readonly interiorColor?: QuoteDocumentColor | null;
}
