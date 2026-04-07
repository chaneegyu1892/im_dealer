export interface RecommendInput {
  industry: string;        // 업종
  purpose: string;         // 사용 목적
  budgetMin: number;       // 예산 하한 (월 납입금 기준)
  budgetMax: number;       // 예산 상한
  paymentStyle: PaymentStyle;
  annualMileage: number;
  returnType: ReturnType;
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

export interface RecommendedVehicleDetail {
  name: string;
  brand: string;
  category: string;
  thumbnailUrl: string;
  defaultTrimName: string;
  defaultTrimPrice: number;
  slug: string;
}

export interface RecommendScenario {
  monthlyPayment: number;
  depositAmount: number;   // 보증금 (원)
  prepayAmount: number;    // 선납금 (원)
  contractMonths: number;
  annualMileage: number;
  contractType: string;    // 인수형 | 반납형
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
    budgetMin: number;
    budgetMax: number;
    paymentStyle: PaymentStyle;
    annualMileage: number;
    returnType: ReturnType;
  };
  vehicles: RecommendedVehicle[];
}

export type PaymentStyle = "보수형" | "표준형" | "공격형";
export type ReturnType = "인수형" | "반납형" | "미정";
