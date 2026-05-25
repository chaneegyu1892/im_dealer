import type { EngineType, VehicleCategory } from "./vehicle";
import type { RecommendScenarios } from "./recommendation";
import type { QuoteScenarioDetails } from "./quote";

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
  tags: string[];
  hasAvailableInventory?: boolean;
}

export interface VehicleDetailedSpecs {
  specs?: Record<string, Record<string, string>>;
  technical_specs?: {
    chassis?: Record<string, string>;
    aerodynamics?: Record<string, string>;
    interior_dimensions?: Record<string, string>;
    capacities?: Record<string, string>;
    electric_system?: Record<string, string>;
  };
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
  detailedSpecs: VehicleDetailedSpecs | null;
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
  optionsTotalPrice?: number;
  colorDelta?: number;
  totalVehiclePrice?: number;
  contractMonths: number;
  annualMileage: number;
  contractType: string;
  customerType?: string;
  scenarios: QuoteScenarioDetails;
  /**
   * 회수율 데이터가 1건도 등록되지 않아 자동 견적이 불가능한 경우 true.
   * 이 경우 scenarios 는 비어 있을 수 있으며, 프론트는 "별도 상담 필요" 안내를 노출한다.
   */
  requiresConsultation?: boolean;
}
