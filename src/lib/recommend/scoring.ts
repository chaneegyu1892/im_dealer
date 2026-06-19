import type { VehicleAttrs } from "./vehicle-attributes";
import {
  INDUSTRY_RULES,
  PURPOSE_RULES,
  MILEAGE_FUEL_RULES,
  CARGO_RULES,
  CHILD_RULES,
  CHARGING_POINTS,
  FUEL_PREFERENCE_POINTS,
  REGION_RULES,
  type RuleContext,
  type ScoreRule,
} from "./scoring-rules";

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

const BASE_SCORE = 50;
const MAX_SCORE = 250;
const MILEAGE_KEYS = [10000, 20000, 30000] as const;

// ─────────────────────────────────────────────
// 입출력 타입
// ─────────────────────────────────────────────

export interface ScoreInput {
  industry: string;
  purpose: string;
  purposeDetail?: string;
  annualMileage: number;
  residenceRegion?: string;
  fuelPreference?: string;
  chargingEnvironment?: string;
}

export interface ScoreCtx {
  category: string;
  price: number;
  fuelEfficiency: number | null;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

// ─────────────────────────────────────────────
// 헬퍼: 연간 주행거리 → 가장 가까운 버킷 키
// ─────────────────────────────────────────────

function nearestMileage(m: number): number {
  return MILEAGE_KEYS.reduce(
    (prev, curr) => (Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev),
    MILEAGE_KEYS[0] as number,
  );
}

// ─────────────────────────────────────────────
// 연료 선호 → 대응 연료 타입 매핑
// ─────────────────────────────────────────────

const FUEL_PREF_MAP: Record<string, VehicleAttrs["fuel"][]> = {
  전기차: ["EV"],
  하이브리드: ["하이브리드"],
  "가솔린/디젤": ["가솔린", "디젤"],
};

// ─────────────────────────────────────────────
// 순수 스코어링 함수
// ─────────────────────────────────────────────

export function scoreVehicle(
  input: ScoreInput,
  attrs: VehicleAttrs,
  ctx: ScoreCtx,
): ScoreResult {
  let score = BASE_SCORE;
  const reasons: string[] = [];

  const rctx: RuleContext = {
    category: ctx.category,
    price: ctx.price,
    fuelEfficiency: ctx.fuelEfficiency,
    annualMileage: input.annualMileage,
    purposeDetail: input.purposeDetail,
  };

  // 규칙 배열 적용 내부 헬퍼 (클로저로 score/reasons 공유)
  const apply = (rules: ScoreRule[]) => {
    for (const rule of rules) {
      if (rule.match(attrs, rctx)) {
        score += rule.pts;
        if (rule.reason) {
          reasons.push(rule.reason);
        }
      }
    }
  };

  // 1. 업종 규칙
  apply(INDUSTRY_RULES[input.industry] ?? []);

  // 2. 목적 규칙
  apply(PURPOSE_RULES[input.purpose] ?? []);

  // 3. 주행거리×연비 규칙
  apply(MILEAGE_FUEL_RULES[nearestMileage(input.annualMileage)] ?? []);

  // 4. 화물 규칙 (화물·배달 목적 시 전용)
  if (input.purpose === "화물·배달") {
    apply(CARGO_RULES);
  }

  // 5. 자녀연령 규칙 (가정용 + purposeDetail 존재 시)
  if (input.purpose === "가정용" && input.purposeDetail) {
    apply(CHILD_RULES[input.purposeDetail] ?? []);
  }

  // 6. 충전환경 가점 (전기차 선호 + EV 차량일 때만)
  if (
    input.fuelPreference === "전기차" &&
    attrs.fuel === "EV" &&
    input.chargingEnvironment
  ) {
    score += CHARGING_POINTS[input.chargingEnvironment] ?? 0;
  }

  // 7. 연료 선호 일치 여부
  if (input.fuelPreference && input.fuelPreference !== "상관없음") {
    const wanted = FUEL_PREF_MAP[input.fuelPreference];
    if (wanted) {
      score += wanted.includes(attrs.fuel)
        ? FUEL_PREFERENCE_POINTS.match
        : FUEL_PREFERENCE_POINTS.mismatch;
    }
  }

  // 8. 거주지역 가점
  if (input.residenceRegion) {
    for (const regionRule of REGION_RULES) {
      if (
        regionRule.region === input.residenceRegion &&
        regionRule.match(attrs)
      ) {
        score += regionRule.pts;
        if (regionRule.reason) {
          reasons.push(regionRule.reason);
        }
      }
    }
  }

  return {
    score: Math.min(MAX_SCORE, score),
    reasons,
  };
}
