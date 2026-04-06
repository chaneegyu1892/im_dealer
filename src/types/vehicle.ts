export interface Vehicle {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: VehicleCategory;
  vehicleCode?: string | null;     // RateConfig 매핑용 공통코드
  basePrice: number;
  thumbnailUrl: string;
  imageUrls: string[];
  surchargeRate: number;           // 차량 가산율 (%)
  isVisible: boolean;
  isPopular: boolean;
  displayOrder: number;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  trims?: Trim[];
}

export interface Trim {
  id: string;
  vehicleId: string;
  name: string;
  price: number;
  engineType: EngineType;
  fuelEfficiency?: number | null;
  isDefault: boolean;
  isVisible: boolean;
  specs?: Record<string, string> | null;
  options?: TrimOption[];
}

export interface TrimOption {
  id: string;
  trimId: string;
  name: string;
  price: number;
  category?: string | null;
  isDefault: boolean;
}

export type VehicleCategory = "세단" | "SUV" | "밴" | "트럭";
export type EngineType = "가솔린" | "디젤" | "하이브리드" | "EV";
