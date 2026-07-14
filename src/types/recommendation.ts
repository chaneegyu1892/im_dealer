export interface RecommendInput {
  industry: string;        // 업종
  preferences: string[];
  primaryPreference?: string;
  situationPreference?: string;
  annualMileage: number;
  returnType: ReturnType;
  // 조건부 추가 질문 답변 (optional)
  industryDetail?: string;
  childDetail?: string;    // "가족" 선택 시 자녀연령
  cargoDetail?: string;    // "화물" 선택 시 소형/대형
  fuelPreference?: string;
  // 전기차 선택 시 충전 환경 (3단계+없음)
  chargingEnvironment?: "자택" | "직장" | "외부" | "없음";
  // 거주지역 (선택, 기본 일반)
  residenceRegion?: "일반" | "강원·산간" | "제주";
  // 옛 세션 호환용 (옵셔널) — 새 입력에서는 사용하지 않음
  purpose?: string;
  purposeDetail?: string;
  budgetMin?: number;
  budgetMax?: number;
  paymentStyle?: PaymentStyle;
  budgetDetail?: string;
}

export interface RecommendResult {
  sessionId: string;
  vehicles: RecommendedVehicle[];
}

export interface RecommendedVehicleBase {
  vehicleId: string;
  rank: number;
  score: number;
  reason: string;          // 짧고 명확한 추천 이유
  highlights: string[];    // 특징 배지
  estimatedMonthly: number;
  vehicle: RecommendedVehicleDetail;
  scenarios: RecommendScenarios;
}

export interface RecommendationScoreContribution {
  readonly kind: "document" | "charging";
  readonly axis:
    | "industry"
    | "primaryPreference"
    | "additionalCondition"
    | "annualMileage"
    | "region"
    | "chargingEnvironment";
  readonly selectedValue: string | null;
  readonly selectedDetail?: string;
  readonly level: "best" | "fit" | "support" | "none";
  readonly rawPoints: number;
  readonly weight: number | null;
  readonly weightedPoints: number;
  readonly evidenceLabel: string;
}

export interface LegacyRecommendedVehicle extends RecommendedVehicleBase {
  readonly scoringVersion?: never;
}

export interface OverlapRecommendedVehicle extends RecommendedVehicleBase {
  readonly scoringVersion: "overlap-v2";
  readonly documentScore: number;
  readonly chargingAdjustment: number;
  readonly rankScore: number;
  readonly contributions: readonly RecommendationScoreContribution[];
  readonly tieBreak: {
    readonly modelYear: number;
    readonly companyPriority: number;
    readonly isPopular: boolean;
    readonly profitPriority: number;
    readonly slug: string;
  };
}

export type RecommendedVehicle = LegacyRecommendedVehicle | OverlapRecommendedVehicle;

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
  /** 신규 추천 결과가 견적 화면까지 동일 트림을 유지하기 위한 식별자. 과거 동결 결과에는 없음. */
  recommendedTrimId?: string;
  /** 월 납입금 계산에 실제 사용한 할인가 우선 차량가. */
  effectiveTrimPrice?: number;
  /** 추천 카드 대표 금액의 금융 상품. 과거 동결 결과에는 없음. */
  productType?: "장기렌트" | "리스";
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
    industryDetail?: string;
    // 결과 요약 칩 표기용 — 신규 흐름은 선택한 선호 라벨, 옛 세션은 목적 문자열
    purpose: string;
    preferences?: string[];
    primaryPreference?: string;
    situationPreference?: string;
    childDetail?: string;
    cargoDetail?: string;
    annualMileage: number;
    returnType: ReturnType;
    fuelPreference?: string;
    chargingEnvironment?: "자택" | "직장" | "외부" | "없음";
    residenceRegion?: "일반" | "강원·산간" | "제주";
    // 옛 세션 호환용 (옵셔널)
    budgetMin?: number;
    budgetMax?: number;
    paymentStyle?: PaymentStyle;
  };
  vehicles: RecommendedVehicle[];
}

export type PaymentStyle = "보수형" | "표준형" | "공격형";
export type ReturnType = "인수형" | "반납형" | "미정";
