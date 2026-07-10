import type { VehicleAttrs } from "./vehicle-attributes";
import {
  INDUSTRY_RULES,
  PREFERENCE_RULES,
  FAMILY_RULES,
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
const PRIMARY_PREFERENCE_WEIGHT = 2;

// ─────────────────────────────────────────────
// 입출력 타입
// ─────────────────────────────────────────────

export interface ScoreInput {
  industry: string;
  preferences: string[];
  primaryPreference?: string;
  situationPreference?: string;
  childDetail?: string;
  cargoDetail?: string;
  annualMileage: number;
  residenceRegion?: string;
  fuelPreference?: string;
  chargingEnvironment?: string;
}

export interface ScoreCtx {
  category: string;
  price: number;
  fuelEfficiency: number | null;
  /** admin scoreMatrix에서 산출된 업종×용도 가산점 (없으면 0) */
  scoreMatrixBonus?: number;
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

  const preferences = input.preferences ?? [];

  const rctx: RuleContext = {
    category: ctx.category,
    price: ctx.price,
    fuelEfficiency: ctx.fuelEfficiency,
    annualMileage: input.annualMileage,
    // 화물 상세 — CARGO_RULES가 참조 (가족 상세는 CHILD_RULES 키로 직접 조회)
    detail: input.cargoDetail,
  };

  // 규칙 배열 적용 내부 헬퍼 (클로저로 score/reasons 공유)
  const apply = (rules: ScoreRule[], weight = 1) => {
    for (const rule of rules) {
      if (rule.match(attrs, rctx)) {
        score += Math.round(rule.pts * weight);
        if (rule.reason) {
          reasons.push(rule.reason);
        }
      }
    }
  };

  // 1. 업종 규칙
  apply(INDUSTRY_RULES[input.industry] ?? []);

  // 2. 선호 특징 규칙 (느낌형 — 선택한 preference 누적 합산)
  for (const pref of preferences) {
    apply(
      PREFERENCE_RULES[pref] ?? [],
      pref === input.primaryPreference ? PRIMARY_PREFERENCE_WEIGHT : 1
    );
  }

  // 3. 주행거리×연비 규칙
  apply(MILEAGE_FUEL_RULES[nearestMileage(input.annualMileage)] ?? []);

  // 4. 가족(상황형) — 기본 규칙 + 자녀연령 상세
  if (preferences.includes("가족")) {
    apply(FAMILY_RULES);
    if (input.childDetail) {
      apply(CHILD_RULES[input.childDetail] ?? []);
    }
  }

  // 5. 화물(상황형) — 화물 규칙 (cargoDetail은 rctx.detail로 전달)
  if (preferences.includes("화물")) {
    apply(CARGO_RULES);
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

  // 9. admin scoreMatrix 가산점 (업종×용도)
  if (ctx.scoreMatrixBonus && ctx.scoreMatrixBonus > 0) {
    score += ctx.scoreMatrixBonus;
  }

  return {
    score: Math.min(MAX_SCORE, score),
    // 복수 선호 선택 시 같은 이유가 중복될 수 있어 제거 (노출 상한은 호출부에서 3개로 컷)
    reasons: [...new Set(reasons)],
  };
}
