import type { EngineType, VehicleCategory } from "./vehicle";
import type { RecommendScenarios } from "./recommendation";
import type { QuoteScenarioDetails } from "./quote";
import type { RepresentativeQuote } from "@/lib/representative-quote";
import type { SubsidyRange } from "@/lib/ev-subsidy";

/** GET /api/vehicles 응답의 개별 차량 */
export interface VehicleListItem {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  basePrice: number;
  /** 노출 트림들의 전기차 보조금(안내용, 견적 미반영) 최소~최대 범위. null = 보조금 없음 */
  evSubsidyRange: SubsidyRange | null;
  thumbnailUrl: string;
  isPopular: boolean;
  /** 차량 탐색(/cars) "주목할 차량" 슬라이더 노출 플래그. isPopular와 별개. */
  isSpotlight?: boolean;
  description: string | null;
  displayOrder: number;
  defaultTrim: {
    name: string;
    price: number;
    engineType: EngineType;
    fuelEfficiency: number | null;
    specs: Record<string, string> | null;
  } | null;
  /** 대표 견적가 산출의 최저 월납입(정렬·요약용). 견적 없으면 0. */
  monthlyFrom: number;
  /** 60개월·무보증·2만km 기준 productType(장기렌트/리스)별 대표 견적가. */
  representativeQuotes?: RepresentativeQuote[];
  highlights: string[];
  /** 차량 특징 해시태그 (자동 산출 + 어드민 수동 보정, 최대 3개). '#' 접두 포함. /cars 전용 보강 필드. */
  hashtags?: string[];
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

export type VehicleImageKind =
  | "MAIN"
  | "COVER"
  | "EXTERIOR_COLOR"
  | "INTERIOR_COLOR"
  | "SPEC_EXTERIOR"
  | "SPEC_INTERIOR"
  | "SPEC_SEAT"
  | "SPEC_OPTION"
  | "CATALOG_PAGE";

export interface VehicleImageItem {
  id: string;
  type: VehicleImageKind;
  title: string | null;
  storageUrl: string;
  displayOrder: number;
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
  /** 노출 트림들의 전기차 보조금(안내용, 견적 미반영) 최소~최대 범위. null = 보조금 없음 */
  evSubsidyRange: SubsidyRange | null;
  thumbnailUrl: string;
  imageUrls: string[];
  images: VehicleImageItem[];
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
  /** 60개월·무보증·2만km 기준 productType(장기렌트/리스)별 대표 견적가. */
  representativeQuotes: RepresentativeQuote[];
  highlights: string[];
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
  /** 할인가 — 있으면 이 값이 차량가 계산 기준으로 사용된다 */
  discountPrice?: number | null;
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
