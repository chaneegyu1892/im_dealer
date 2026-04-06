import type { EngineType, VehicleCategory } from "./vehicle";
import type { RecommendScenarios } from "./recommendation";

/** GET /api/vehicles 응답의 개별 차량 */
export interface VehicleListItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  basePrice: number;
  thumbnailUrl: string;
  isPopular: boolean;
  description: string | null;
  displayOrder: number;
  defaultTrim: {
    name: string;
    price: number;
    engineType: EngineType;
    fuelEfficiency: number | null;
    specs: Record<string, string> | null;
  } | null;
  monthlyFrom: number;
  highlights: string[];
}

/** GET /api/vehicles/:slug 응답 data */
export interface VehicleDetail {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  vehicleCode: string | null;
  basePrice: number;
  thumbnailUrl: string;
  imageUrls: string[];
  surchargeRate: number;
  isPopular: boolean;
  description: string | null;
  trims: VehicleDetailTrim[];
  defaultTrim: {
    id: string;
    name: string;
    price: number;
    engineType: EngineType;
    fuelEfficiency: number | null;
    specs: Record<string, string> | null;
  } | null;
  scenarios: RecommendScenarios | null;
  bestFinanceName: string | null;
  highlights: string[];
  aiCaption: string | null;
  hasRateConfig: boolean;
}

export interface VehicleDetailTrim {
  id: string;
  name: string;
  price: number;
  engineType: EngineType;
  fuelEfficiency: number | null;
  isDefault: boolean;
  specs: Record<string, string> | null;
  options: { id: string; name: string; price: number; category: string | null; isDefault: boolean }[];
}

/** POST /api/vehicles/:slug/quote 응답 data */
export interface QuoteResponse {
  vehicleSlug: string;
  trimId: string;
  trimName: string;
  trimPrice: number;
  contractMonths: number;
  annualMileage: number;
  contractType: string;
  scenarios: RecommendScenarios;
}
