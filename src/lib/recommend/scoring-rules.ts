import type { VehicleAttrs } from "./vehicle-attributes";

// ─────────────────────────────────────────────
// 라벨 일관성 테스트용 상수 (label-consistency.test.ts에서 검증)
// ─────────────────────────────────────────────

// 실제 선택지 value와 1:1 (label-consistency 테스트로 강제됨)
export const SCORING_INDUSTRIES = ["법인", "개인사업자", "개인"] as const;
export const SCORING_PURPOSES = [
  "출퇴근·업무용",
  "영업·외근",
  "화물·배달",
  "임원용·의전",
  "가정용",
] as const;

// ─────────────────────────────────────────────
// 가격 프록시 (category에 대형/프리미엄/경차/소형이 없어 price로 차급 근사)
// ─────────────────────────────────────────────

const COMPACT_MAX = 25_000_000; // 경차·소형
const LARGE_MIN = 50_000_000; // 대형·프리미엄
const OFFICIAL_MIN = 60_000_000; // 의전 최소
const OVER_LIMIT = 80_000_000; // 개인사업자 업무용 한도 초과

const isCompact = (price: number) => price < COMPACT_MAX;
const isLargeOrPremium = (price: number) => price >= LARGE_MIN;

// ─────────────────────────────────────────────
// 규칙 컨텍스트 / 타입
// ─────────────────────────────────────────────

export interface RuleContext {
  category: string;
  price: number;
  fuelEfficiency: number | null;
  annualMileage: number;
  purposeDetail?: string;
}

export interface ScoreRule {
  match: (a: VehicleAttrs, c: RuleContext) => boolean;
  pts: number;
  reason?: string;
}

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────

// null 폴백은 0. 보상 규칙(>= 12, >= 15)은 null 안전(0은 기준 미달). 패널티 규칙(< N)은 반드시 별도 `c.fuelEfficiency !== null` 가드와 함께 사용할 것.
const eff = (c: RuleContext) => c.fuelEfficiency ?? 0;

// ─────────────────────────────────────────────
// 업종 규칙 (문서 1장)
// ─────────────────────────────────────────────

export const INDUSTRY_RULES: Record<string, ScoreRule[]> = {
  법인: [
    {
      match: (_a, c) => c.category === "세단" && isLargeOrPremium(c.price),
      pts: 20,
      reason: "법인 임원용 품격과 비용처리 효율을 동시에 잡을 수 있어요",
    },
    {
      match: (_a, c) => c.category === "SUV" && isLargeOrPremium(c.price),
      pts: 18,
      reason: "법인 운용리스 시 회수율이 높아 월납입금이 유리해요",
    },
    {
      match: (a) => a.fuel === "EV",
      pts: 15,
      reason: "법인 전기차는 취득세 감면과 비용처리 혜택이 커요",
    },
    {
      match: (_a, c) => isCompact(c.price),
      pts: -15,
    },
  ],
  개인사업자: [
    {
      match: (a) => a.fuel === "하이브리드" || a.fuel === "EV",
      pts: 12,
      reason: "연료비 절감으로 실질 운영비용이 낮아져요",
    },
    {
      match: (_a, c) => c.category === "밴" || c.category === "트럭",
      pts: 10,
    },
    {
      match: (_a, c) => isCompact(c.price),
      pts: 8,
      reason: "취득세·보험료·주차비를 모두 아낄 수 있어요",
    },
    {
      match: (_a, c) => c.price >= OVER_LIMIT,
      pts: -10,
      reason: "업무용 차량 한도 초과 리스크가 있어요",
    },
  ],
  개인: [
    {
      match: (a) => a.isPopular,
      pts: 10,
      reason: "많은 분들이 선택한 검증된 차량이에요",
    },
    {
      match: (a) => a.fuel === "EV",
      pts: 12,
      reason: "유지비가 내연기관 대비 크게 절감돼요",
    },
  ],
};

// ─────────────────────────────────────────────
// 목적 규칙 (문서 2장)
// ─────────────────────────────────────────────

export const PURPOSE_RULES: Record<string, ScoreRule[]> = {
  "출퇴근·업무용": [
    {
      match: (_a, c) => eff(c) >= 15,
      pts: 15,
      reason: "매일 타는 차, 연비가 곧 월 절감액이에요",
    },
    {
      match: (a) => a.fuel === "하이브리드",
      pts: 12,
      reason: "시내 주행 많은 출퇴근에 하이브리드가 최적이에요",
    },
    {
      match: (a) => a.fuel === "EV",
      pts: 15,
      reason: "출퇴근 구간이라면 전기차로 연료비를 크게 아껴요",
    },
    {
      match: (_a, c) => c.category === "세단",
      pts: 8,
      reason: "주차가 편한 세단이에요",
    },
    {
      match: (_a, c) => c.category === "트럭" || c.category === "밴",
      pts: -15,
    },
  ],
  "영업·외근": [
    {
      match: (_a, c) => eff(c) >= 15,
      pts: 15,
      reason: "외근이 잦을수록 연비가 비용을 좌우해요",
    },
    {
      match: (a) => a.fuel === "하이브리드",
      pts: 12,
    },
    {
      match: (_a, c) => c.category === "SUV",
      pts: 8,
      reason: "영업 샘플·장비를 넉넉히 실을 수 있어요",
    },
    {
      match: (_a, c) => isCompact(c.price),
      pts: 10,
      reason: "소규모 영업에 경제적이에요",
    },
  ],
  // 임원용·의전: 대형 세단은 세단+20과 프리미엄+18을 모두 받아 +38(의도된 누적, 세단 > SUV).
  // 가격 하한 패널티(-15/-25)는 ai-recommender의 6천만 하드 게이트와 중복되는 방어 규칙.
  "임원용·의전": [
    {
      match: (_a, c) => c.category === "세단" && isLargeOrPremium(c.price),
      pts: 20,
      reason: "임원 의전용으로 품격과 승차감이 검증된 차량이에요",
    },
    {
      match: (_a, c) => (c.category === "세단" || c.category === "SUV") && isLargeOrPremium(c.price),
      pts: 18,
    },
    {
      match: (_a, c) => c.price < OFFICIAL_MIN,
      pts: -15,
      reason: "의전 목적에는 다소 아쉬운 차급이에요",
    },
    {
      match: (_a, c) => isCompact(c.price),
      pts: -25,
    },
    {
      match: (_a, c) => c.category === "SUV" && isLargeOrPremium(c.price),
      pts: 10,
      reason: "넓은 실내공간으로 비즈니스 이동에 적합해요",
    },
  ],
  가정용: [
    {
      match: (_a, c) => c.category === "SUV",
      pts: 15,
      reason: "가족 나들이에 넓은 공간과 높은 시야가 편리해요",
    },
    {
      match: (a) => (a.seating ?? 0) >= 7,
      pts: 12,
      reason: "온 가족이 함께 탈 수 있는 공간이에요",
    },
    {
      match: (a) => a.hasAdvancedSafety,
      pts: 10,
      reason: "가족 안전을 위한 첨단 안전사양을 갖췄어요",
    },
  ],
  "화물·배달": [],
};

// ─────────────────────────────────────────────
// 주행거리×연비 규칙 (문서 3장)
// 키: 가장 가까운 1만/2만/3만
// ─────────────────────────────────────────────

export const MILEAGE_FUEL_RULES: Record<number, ScoreRule[]> = {
  10000: [
    {
      match: (_a, c) => isCompact(c.price),
      pts: 5,
      reason: "단거리 위주라면 경차·소형이 경제적이에요",
    },
  ],
  20000: [
    {
      match: (_a, c) => eff(c) >= 15,
      pts: 10,
    },
    {
      match: (_a, c) => eff(c) >= 12 && eff(c) < 15,
      pts: 5,
    },
    {
      match: (_a, c) => c.fuelEfficiency !== null && eff(c) < 12,
      pts: -5,
    },
    {
      match: (a) => a.fuel === "하이브리드",
      pts: 12,
      reason: "연 2만km라면 하이브리드로 연료비를 크게 아껴요",
    },
  ],
  30000: [
    {
      match: (a) => a.fuel === "EV",
      pts: 20,
      reason: "연 3만km 운행 시 전기차로 연료비를 크게 절감해요",
    },
    {
      match: (a) => a.fuel === "하이브리드",
      pts: 18,
    },
    {
      match: (_a, c) => eff(c) >= 15,
      pts: 15,
    },
    {
      match: (_a, c) => c.fuelEfficiency !== null && eff(c) < 12,
      pts: -10,
    },
    {
      match: (a) => a.fuel === "디젤",
      pts: 10,
      reason: "장거리 운행에는 디젤 고효율 모델이 유리해요",
    },
  ],
};

// ─────────────────────────────────────────────
// 화물 규칙 (문서 4장)
// purpose === "화물·배달"일 때만 적용
// purposeDetail: "소형 박스" | "대형 화물"
// ─────────────────────────────────────────────

export const CARGO_RULES: ScoreRule[] = [
  {
    match: (_a, c) => c.purposeDetail === "소형 박스" && c.category === "밴",
    pts: 15,
  },
  {
    match: (_a, c) => c.purposeDetail === "소형 박스" && c.category === "SUV",
    pts: 10,
  },
  {
    match: (_a, c) => c.purposeDetail === "소형 박스" && c.category === "세단",
    pts: 5,
  },
  {
    match: (a, c) =>
      c.purposeDetail === "대형 화물" &&
      a.cargoKg !== null &&
      a.cargoKg >= 1000 &&
      a.cargoKg < 1500,
    pts: 25,
    reason: "1톤급 적재에 적합해요",
  },
  {
    match: (a, c) =>
      c.purposeDetail === "대형 화물" &&
      a.cargoKg !== null &&
      a.cargoKg >= 1500,
    pts: 30,
    reason: "대형 적재에 최적화됐어요",
  },
  {
    match: (_a, c) =>
      c.purposeDetail === "대형 화물" &&
      (c.category === "세단" || c.category === "SUV"),
    pts: -20,
  },
  {
    match: (a) => a.isRefrigerated,
    pts: 25,
    reason: "냉장·냉동 화물을 위한 특장이 가능해요",
  },
];

// ─────────────────────────────────────────────
// 자녀연령 규칙 (문서 5장)
// purpose === "가정용"일 때만 적용, purposeDetail 키
// ─────────────────────────────────────────────

export const CHILD_RULES: Record<string, ScoreRule[]> = {
  영유아: [
    {
      match: (_a, c) => c.category === "SUV",
      pts: 20,
      reason: "유모차를 쉽게 싣고 내릴 수 있는 넓은 적재공간이에요",
    },
    {
      match: (a) => a.hasSlidingDoor,
      pts: 15,
      reason: "슬라이딩 도어로 카시트·유모차 장착이 편리해요",
    },
    {
      match: (_a, c) => c.category === "세단",
      pts: -10,
    },
  ],
  미취학: [
    {
      match: (_a, c) => c.category === "SUV",
      pts: 18,
      reason: "카시트 장착과 아이 승하차가 편한 실내예요",
    },
    {
      match: (a) => (a.seating ?? 0) >= 7,
      pts: 10,
    },
    {
      match: (a) => a.hasAdvancedSafety,
      pts: 15,
      reason: "어린이 동승 시 중요한 안전사양을 갖췄어요",
    },
  ],
  초등: [
    {
      match: (_a, c) => c.category === "SUV" || c.category === "밴",
      pts: 15,
    },
    {
      match: (a) => (a.seating ?? 0) >= 7,
      pts: 12,
      reason: "아이와 친구들 함께 탈 수 있는 공간이에요",
    },
  ],
  "중학생+": [
    {
      match: (_a, c) => c.category === "SUV" || c.category === "세단",
      pts: 10,
    },
  ],
};

// ─────────────────────────────────────────────
// 충전환경 가점 (문서 6-4)
// EV + 전기차 선호일 때만 적용
// ─────────────────────────────────────────────

export const CHARGING_POINTS: Record<string, number> = {
  자택: 20,
  직장: 15,
  외부: 5,
  없음: -15,
};

// ─────────────────────────────────────────────
// 연료 선호 일치 가점
// ─────────────────────────────────────────────

export const FUEL_PREFERENCE_POINTS = { match: 10, mismatch: -5 } as const;

// ─────────────────────────────────────────────
// 거주지역 규칙 (문서 6-2)
// ─────────────────────────────────────────────

export interface RegionRule {
  region: string;
  match: (a: VehicleAttrs) => boolean;
  pts: number;
  reason?: string;
}
export const REGION_RULES: RegionRule[] = [
  {
    region: "강원·산간",
    match: (a) => a.isAwd,
    pts: 15,
    reason: "눈길·비포장에서 안정적인 사륜구동이에요",
  },
  {
    region: "제주",
    match: (a) => a.fuel === "EV",
    pts: 20,
    reason: "제주는 전기차 보조금과 충전 인프라가 우수해요",
  },
];
