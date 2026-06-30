import type { VehicleAttrs } from "./vehicle-attributes";

// ─────────────────────────────────────────────
// 라벨 일관성 테스트용 상수 (label-consistency.test.ts에서 검증)
// ─────────────────────────────────────────────

// 실제 선택지 value와 1:1 (label-consistency 테스트로 강제됨)
export const SCORING_INDUSTRIES = ["법인", "개인사업자", "개인"] as const;

// 「원하는 차」 선호 특징 — 느낌형 4 + 상황형 2.
// 느낌형(안정감/주차편의/경제성/고급)은 PREFERENCE_RULES,
// 상황형(가족/화물)은 FAMILY_RULES+CHILD_RULES / CARGO_RULES 로 점수화된다.
export const SCORING_PREFERENCES = [
  "안정감",
  "주차편의",
  "경제성",
  "고급",
  "가족",
  "화물",
] as const;

// ─────────────────────────────────────────────
// 가격 프록시 (category에 대형/프리미엄/경차/소형이 없어 price로 차급 근사)
// ─────────────────────────────────────────────

const COMPACT_MAX = 25_000_000; // 경차·소형
const LARGE_MIN = 50_000_000; // 대형·프리미엄
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
  // 상황형 상세값: 화물(소형 박스/대형 화물)에서 CARGO_RULES가 참조.
  detail?: string;
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
// 선호 특징 규칙 (느낌형 4종) — 「원하는 차」 질문
// 각 규칙셋은 선택된 preference value 기준으로 누적 합산된다.
// ─────────────────────────────────────────────

export const PREFERENCE_RULES: Record<string, ScoreRule[]> = {
  // 크고 안정감 있는 차 — 대형 SUV/세단, 사륜
  안정감: [
    {
      match: (_a, c) => c.category === "SUV" && isLargeOrPremium(c.price),
      pts: 18,
      reason: "든든한 차체와 높은 시야로 안정적이에요",
    },
    {
      match: (_a, c) => c.category === "세단" && isLargeOrPremium(c.price),
      pts: 12,
    },
    {
      match: (a) => a.isAwd,
      pts: 10,
      reason: "사륜구동으로 어떤 노면에서도 안정적이에요",
    },
    {
      match: (_a, c) => isCompact(c.price),
      pts: -10,
    },
  ],
  // 작고 주차 편한 차 — 경차·소형, 세단
  주차편의: [
    {
      match: (_a, c) => isCompact(c.price),
      pts: 18,
      reason: "좁은 길과 주차가 편한 차급이에요",
    },
    {
      match: (_a, c) => c.category === "세단",
      pts: 6,
    },
    {
      match: (_a, c) => isLargeOrPremium(c.price),
      pts: -12,
    },
    {
      match: (_a, c) => c.category === "밴" || c.category === "트럭",
      pts: -8,
    },
  ],
  // 유지비 경제적인 차 — 고연비·하이브리드·EV·소형
  경제성: [
    {
      match: (_a, c) => eff(c) >= 15,
      pts: 15,
      reason: "연비가 좋아 유지비를 아낄 수 있어요",
    },
    {
      match: (a) => a.fuel === "하이브리드",
      pts: 15,
      reason: "하이브리드로 연료비 부담을 크게 줄여요",
    },
    {
      match: (a) => a.fuel === "EV",
      pts: 12,
      reason: "전기차로 유지비를 크게 절감해요",
    },
    {
      match: (_a, c) => isCompact(c.price),
      pts: 8,
    },
    {
      match: (_a, c) => c.fuelEfficiency !== null && eff(c) < 12,
      pts: -8,
    },
  ],
  // 품격 있는 고급차 — 프리미엄 세단/SUV (구 임원용·의전)
  고급: [
    {
      match: (_a, c) => c.category === "세단" && isLargeOrPremium(c.price),
      pts: 20,
      reason: "품격과 승차감이 검증된 차급이에요",
    },
    {
      match: (_a, c) => c.category === "SUV" && isLargeOrPremium(c.price),
      pts: 12,
      reason: "넓은 실내공간으로 비즈니스 이동에 적합해요",
    },
    {
      match: (_a, c) => isCompact(c.price),
      pts: -20,
    },
  ],
};

// ─────────────────────────────────────────────
// 가족(상황형) 기본 규칙 — preference "가족" 선택 시 적용.
// 추가로 CHILD_RULES[childDetail]가 누적된다.
// ─────────────────────────────────────────────

export const FAMILY_RULES: ScoreRule[] = [
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
];

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
// preference "화물" 선택 시에만 적용
// detail(cargoDetail): "소형 박스" | "대형 화물"
// ─────────────────────────────────────────────

export const CARGO_RULES: ScoreRule[] = [
  {
    match: (_a, c) => c.detail === "소형 박스" && c.category === "밴",
    pts: 15,
  },
  {
    match: (_a, c) => c.detail === "소형 박스" && c.category === "SUV",
    pts: 10,
  },
  {
    match: (_a, c) => c.detail === "소형 박스" && c.category === "세단",
    pts: 5,
  },
  {
    match: (a, c) =>
      c.detail === "대형 화물" &&
      a.cargoKg !== null &&
      a.cargoKg >= 1000 &&
      a.cargoKg < 1500,
    pts: 25,
    reason: "1톤급 적재에 적합해요",
  },
  {
    match: (a, c) =>
      c.detail === "대형 화물" &&
      a.cargoKg !== null &&
      a.cargoKg >= 1500,
    pts: 30,
    reason: "대형 적재에 최적화됐어요",
  },
  {
    match: (_a, c) =>
      c.detail === "대형 화물" &&
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
// preference "가족" 선택 시에만 적용, childDetail 키
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
