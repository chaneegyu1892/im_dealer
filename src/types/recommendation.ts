export interface RecommendInput {
  industry: string;        // 업종
  purpose: string;         // 사용 목적
  annualMileage: number;
  returnType: ReturnType;
  // 조건부 추가 질문 답변 (optional)
  industryDetail?: string;
  purposeDetail?: string;
  fuelPreference?: string;
  // 전기차 선택 시 충전 환경
  chargingEnvironment?: "있음" | "없음" | "모르겠음";
  // 옛 세션 호환용 (옵셔널) — 새 입력에서는 사용하지 않음
  budgetMin?: number;
  budgetMax?: number;
  paymentStyle?: PaymentStyle;
  budgetDetail?: string;
}

export interface RecommendResult {
  sessionId: string;
  vehicles: RecommendedVehicle[];
}

export interface RecommendedVehicle {
  vehicleId: string;
  rank: number;
  score: number;
  reason: string;          // 짧고 명확한 추천 이유
  highlights: string[];    // 특징 배지
  estimatedMonthly: number;
  vehicle: RecommendedVehicleDetail;
  scenarios: RecommendScenarios;
}

export interface PopularConfigItem {
  id: string;
  name: string;
  price: number;
  trimOptionId?: string | null;
}

export interface PopularConfig {
  id: string;
  name: string;
  note: string | null;
  items: PopularConfigItem[];
}

export interface RecommendedVehicleDetail {
  name: string;
  brand: string;
  category: string;
  thumbnailUrl: string;
  imageUrls?: string[];
  defaultTrimName: string;
  defaultTrimPrice: number;
  slug: string;
  popularConfigs: PopularConfig[];
}

export interface RecommendScenario {
  monthlyPayment: number;
  depositAmount: number;   // 보증금 (원)
  prepayAmount: number;    // 선납금 (원)
  contractMonths: number;
  annualMileage: number;
  contractType: string;    // 인수형 | 반납형
  /** 회원 전용 시나리오를 비회원에게 잠근 상태. true 면 금액 필드는 0(빈값)이며
   * 실제 값은 서버 응답에 포함되지 않는다(보안 경계). */
  locked?: boolean;
}

export interface RecommendScenarios {
  conservative: RecommendScenario;  // 보수형: 보증금 20%
  standard: RecommendScenario;      // 표준형: 보증금·선납금 0%
  aggressive: RecommendScenario;    // 공격형: 선납금 30%
}

/** 금융사별 비교 정보 (결과 카드에서 사용) */
export interface FinanceCompanyQuote {
  financeCompanyName: string;
  monthlyPayment: number;
  rank: number;
}

export interface RecommendResultResponse {
  sessionId: string;
  input: {
    industry: string;
    purpose: string;
    annualMileage: number;
    returnType: ReturnType;
    fuelPreference?: string;
    chargingEnvironment?: "있음" | "없음" | "모르겠음";
    // 옛 세션 호환용 (옵셔널)
    budgetMin?: number;
    budgetMax?: number;
    paymentStyle?: PaymentStyle;
  };
  vehicles: RecommendedVehicle[];
}

export type PaymentStyle = "보수형" | "표준형" | "공격형";
export type ReturnType = "인수형" | "반납형" | "미정";
