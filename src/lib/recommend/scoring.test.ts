import { describe, it, expect } from "vitest";
import { scoreVehicle } from "./scoring";
import type { ScoreInput, ScoreCtx } from "./scoring";
import type { VehicleAttrs } from "./vehicle-attributes";

// ─────────────────────────────────────────────
// 테스트 픽스처 헬퍼
// ─────────────────────────────────────────────

const BASE_ATTRS: VehicleAttrs = {
  isAwd: false,
  cargoKg: null,
  isRefrigerated: false,
  seating: 5,
  fuel: "가솔린",
  hasSlidingDoor: false,
  hasAdvancedSafety: false,
  isPopular: false,
};

const BASE_INPUT: ScoreInput = {
  industry: "개인",
  preferences: [],
  annualMileage: 20000,
};

const BASE_CTX: ScoreCtx = {
  category: "세단",
  price: 35_000_000,
  fuelEfficiency: 10,
};

// ─────────────────────────────────────────────
// 케이스 1: 법인 + EV SUV (price 50M) — 업종 규칙
// ─────────────────────────────────────────────

describe("법인 + EV SUV 50M", () => {
  it("score는 base 50 + SUV 프리미엄 18 + EV 15 이상이어야 한다", () => {
    const input: ScoreInput = { ...BASE_INPUT, industry: "법인" };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { category: "SUV", price: 50_000_000, fuelEfficiency: null };

    const { score } = scoreVehicle(input, attrs, ctx);

    // base(50) + SUV프리미엄(18) + EV법인(15) = 최소 83
    expect(score).toBeGreaterThanOrEqual(50 + 18 + 15);
  });

  it("EV 법인 차량에는 EV 관련 reason이 포함되어야 한다", () => {
    const input: ScoreInput = { ...BASE_INPUT, industry: "법인" };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { category: "SUV", price: 50_000_000, fuelEfficiency: null };

    const { reasons } = scoreVehicle(input, attrs, ctx);

    expect(reasons.some((r) => r.includes("전기차") || r.includes("취득세") || r.includes("EV"))).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 케이스 2: 가족 + 영유아 + 슬라이딩도어 SUV
// ─────────────────────────────────────────────

describe("가족 + 영유아 + 슬라이딩도어 SUV", () => {
  const input: ScoreInput = {
    ...BASE_INPUT,
    industry: "개인",
    preferences: ["가족"],
    childDetail: "영유아",
  };
  const attrs: VehicleAttrs = { ...BASE_ATTRS, hasSlidingDoor: true };
  const ctx: ScoreCtx = { category: "SUV", price: 35_000_000, fuelEfficiency: null };

  it("슬라이딩 도어 관련 reason이 포함되어야 한다", () => {
    const { reasons } = scoreVehicle(input, attrs, ctx);
    expect(reasons.some((r) => r.includes("슬라이딩"))).toBe(true);
  });

  it("SUV 영유아: 가족 SUV +15, 영유아 SUV +20, 슬라이딩 +15 = 50+15+20+15=100", () => {
    const { score } = scoreVehicle(input, attrs, ctx);
    expect(score).toBe(100);
  });
});

// ─────────────────────────────────────────────
// 케이스 3: 화물 + 대형 화물 + cargoKg
// ─────────────────────────────────────────────

describe("화물 + 대형 화물 + cargoKg", () => {
  it("1000kg는 +25 (1톤급) 가점이 반영되어야 한다", () => {
    const input: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인사업자",
      preferences: ["화물"],
      cargoDetail: "대형 화물",
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, cargoKg: 1000, fuel: "디젤" };
    const ctx: ScoreCtx = { category: "트럭", price: 30_000_000, fuelEfficiency: 12 };

    const { score, reasons } = scoreVehicle(input, attrs, ctx);

    expect(score).toBeGreaterThanOrEqual(50 + 25);
    expect(reasons.some((r) => r.includes("1톤급"))).toBe(true);
  });

  it("1500kg 이상이면 +30 (대형 적재) 가점을 받아야 한다", () => {
    const input: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인사업자",
      preferences: ["화물"],
      cargoDetail: "대형 화물",
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, cargoKg: 2000 };
    const ctx: ScoreCtx = { category: "트럭", price: 30_000_000, fuelEfficiency: null };

    const { reasons } = scoreVehicle(input, attrs, ctx);

    expect(reasons.some((r) => r.includes("대형 적재"))).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 케이스 4: 상한 250 클램핑
// ─────────────────────────────────────────────

describe("상한 250 클램핑", () => {
  it("극단적으로 유리한 조건도 score <= 250", () => {
    const input: ScoreInput = {
      industry: "법인",
      preferences: ["고급", "안정감"],
      annualMileage: 30000,
      fuelPreference: "전기차",
      chargingEnvironment: "자택",
      residenceRegion: "제주",
    };
    const attrs: VehicleAttrs = {
      isAwd: true,
      cargoKg: null,
      isRefrigerated: false,
      seating: 5,
      fuel: "EV",
      hasSlidingDoor: false,
      hasAdvancedSafety: true,
      isPopular: true,
    };
    const ctx: ScoreCtx = { category: "세단", price: 80_000_000, fuelEfficiency: 20 };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBeLessThanOrEqual(250);
  });
});

// ─────────────────────────────────────────────
// 케이스 5: 주차편의 → 트럭 패널티 / 세단 가점
// ─────────────────────────────────────────────

describe("주차편의 선호 시 차급별 가감", () => {
  it("세단(+6)이 트럭(-8)보다 점수가 높아야 한다 (차이 14)", () => {
    const input: ScoreInput = { ...BASE_INPUT, preferences: ["주차편의"] };
    const attrs: VehicleAttrs = { ...BASE_ATTRS };

    const sedanCtx: ScoreCtx = { category: "세단", price: 35_000_000, fuelEfficiency: 10 };
    const truckCtx: ScoreCtx = { category: "트럭", price: 35_000_000, fuelEfficiency: 10 };

    const sedanScore = scoreVehicle(input, attrs, sedanCtx).score;
    const truckScore = scoreVehicle(input, attrs, truckCtx).score;

    expect(sedanScore - truckScore).toBe(14);
    expect(truckScore).toBeLessThan(sedanScore);
  });
});

// ─────────────────────────────────────────────
// 케이스 6: 복수 선택 합산 — 경제성 + 주차편의
// ─────────────────────────────────────────────

describe("복수 선택 합산 (경제성 + 주차편의)", () => {
  it("소형 하이브리드는 두 선호 가점을 모두 누적한다", () => {
    const single: ScoreInput = { ...BASE_INPUT, preferences: ["경제성"] };
    const both: ScoreInput = { ...BASE_INPUT, preferences: ["경제성", "주차편의"] };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "하이브리드" };
    const ctx: ScoreCtx = { category: "세단", price: 20_000_000, fuelEfficiency: 18 };

    const singleScore = scoreVehicle(single, attrs, ctx).score;
    const bothScore = scoreVehicle(both, attrs, ctx).score;

    // 주차편의: isCompact(+18) + 세단(+6) = +24 추가
    expect(bothScore - singleScore).toBe(24);
  });
});

// ─────────────────────────────────────────────
// 케이스 7: 느낌형 + 상황형 혼합 (안정감 + 가족)
// ─────────────────────────────────────────────

describe("안정감 + 가족 혼합", () => {
  it("대형 SUV에 안정감·가족 가점이 모두 누적된다", () => {
    const input: ScoreInput = {
      ...BASE_INPUT,
      preferences: ["안정감", "가족"],
      childDetail: "미취학",
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, hasAdvancedSafety: true };
    const ctx: ScoreCtx = { category: "SUV", price: 55_000_000, fuelEfficiency: null };

    const onlyStable: ScoreInput = { ...BASE_INPUT, preferences: ["안정감"] };
    const stableScore = scoreVehicle(onlyStable, attrs, ctx).score;
    const bothScore = scoreVehicle(input, attrs, ctx).score;

    // 가족: FAMILY SUV(+15) + 안전(+10) + CHILD 미취학 SUV(+18) + 안전(+15) = +58
    expect(bothScore).toBeGreaterThan(stableScore);
  });
});

// ─────────────────────────────────────────────
// 케이스 8: nearestMileage — 22000 → 20000 규칙 적용
// ─────────────────────────────────────────────

describe("nearestMileage: 22000 → 20000 규칙 적용", () => {
  it("22000km는 20000 규칙 버킷을 사용해야 한다", () => {
    const input20: ScoreInput = { ...BASE_INPUT, annualMileage: 20000 };
    const input22: ScoreInput = { ...BASE_INPUT, annualMileage: 22000 };
    const attrs: VehicleAttrs = { ...BASE_ATTRS };
    const ctx: ScoreCtx = { category: "세단", price: 35_000_000, fuelEfficiency: 16 };

    const score20 = scoreVehicle(input20, attrs, ctx).score;
    const score22 = scoreVehicle(input22, attrs, ctx).score;

    expect(score22).toBe(score20);
  });

  it("28000km는 30000 버킷을 사용해야 한다 (20000 버킷과 다른 점수)", () => {
    const input20: ScoreInput = { ...BASE_INPUT, annualMileage: 20000 };
    const input28: ScoreInput = { ...BASE_INPUT, annualMileage: 28000 };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { category: "SUV", price: 50_000_000, fuelEfficiency: 5 };

    const score20 = scoreVehicle(input20, attrs, ctx).score;
    const score28 = scoreVehicle(input28, attrs, ctx).score;

    expect(score28).not.toBe(score20);
  });
});

// ─────────────────────────────────────────────
// 케이스 9: 충전환경 가점
// ─────────────────────────────────────────────

describe("충전환경 가점 (EV + 전기차 선호 시)", () => {
  it("자택 충전이면 +20 가점이 있어야 한다", () => {
    const inputWithCharging: ScoreInput = {
      ...BASE_INPUT,
      fuelPreference: "전기차",
      chargingEnvironment: "자택",
    };
    const inputNoCharging: ScoreInput = {
      ...BASE_INPUT,
      fuelPreference: "전기차",
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { category: "SUV", price: 50_000_000, fuelEfficiency: null };

    const scoreWithCharging = scoreVehicle(inputWithCharging, attrs, ctx).score;
    const scoreNoCharging = scoreVehicle(inputNoCharging, attrs, ctx).score;

    expect(scoreWithCharging - scoreNoCharging).toBe(20);
  });

  it("충전 환경이 없으면 -15 패널티가 있어야 한다", () => {
    const inputWithNone: ScoreInput = {
      ...BASE_INPUT,
      fuelPreference: "전기차",
      chargingEnvironment: "없음",
    };
    const inputNoCharging: ScoreInput = {
      ...BASE_INPUT,
      fuelPreference: "전기차",
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { category: "세단", price: 35_000_000, fuelEfficiency: null };

    const scoreNone = scoreVehicle(inputWithNone, attrs, ctx).score;
    const scoreNoCharging = scoreVehicle(inputNoCharging, attrs, ctx).score;

    expect(scoreNone - scoreNoCharging).toBe(-15);
  });
});

// ─────────────────────────────────────────────
// 케이스 10: 연료 선호 일치/불일치
// ─────────────────────────────────────────────

describe("연료 선호 일치/불일치", () => {
  it("선호 연료와 차량 연료 일치 시 +10", () => {
    const inputMatch: ScoreInput = { ...BASE_INPUT, fuelPreference: "하이브리드" };
    const inputNone: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "하이브리드" };
    const ctx: ScoreCtx = { ...BASE_CTX };

    expect(
      scoreVehicle(inputMatch, attrs, ctx).score - scoreVehicle(inputNone, attrs, ctx).score
    ).toBe(10);
  });

  it("선호 연료와 차량 연료 불일치 시 -5", () => {
    const inputMismatch: ScoreInput = { ...BASE_INPUT, fuelPreference: "전기차" };
    const inputNone: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "가솔린" };
    const ctx: ScoreCtx = { ...BASE_CTX };

    expect(
      scoreVehicle(inputMismatch, attrs, ctx).score - scoreVehicle(inputNone, attrs, ctx).score
    ).toBe(-5);
  });

  it("상관없음 선택 시 가감 없음", () => {
    const inputDontCare: ScoreInput = { ...BASE_INPUT, fuelPreference: "상관없음" };
    const inputNone: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "가솔린" };
    const ctx: ScoreCtx = { ...BASE_CTX };

    expect(scoreVehicle(inputDontCare, attrs, ctx).score).toBe(
      scoreVehicle(inputNone, attrs, ctx).score
    );
  });
});

// ─────────────────────────────────────────────
// 케이스 11: 고급 + compact 패널티
// ─────────────────────────────────────────────

describe("고급 선호 + compact 차량 패널티", () => {
  it("price 20M compact 세단은 고급 -20 + mileage 연비패널티 -5 = 25", () => {
    // base(50) + 고급 isCompact(-20) + mileage20k 연비<12(-5) = 25
    const input: ScoreInput = {
      industry: "개인",
      preferences: ["고급"],
      annualMileage: 20000,
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS };
    const ctx: ScoreCtx = { category: "세단", price: 20_000_000, fuelEfficiency: 10 };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBe(25);
  });
});

// ─────────────────────────────────────────────
// 케이스 12: 가족 상세(childDetail) 없으면 CHILD_RULES 미적용
// ─────────────────────────────────────────────

describe("가족 childDetail 없으면 CHILD_RULES 미적용", () => {
  it("SUV 가족 childDetail 없으면 FAMILY SUV +15만 반영하여 score=65", () => {
    // base(50) + FAMILY SUV(+15) + mileage10k compact아님(0) = 65
    const input: ScoreInput = {
      industry: "개인",
      preferences: ["가족"],
      annualMileage: 10000,
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS };
    const ctx: ScoreCtx = { category: "SUV", price: 35_000_000, fuelEfficiency: null };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBe(65);
  });
});

// ─────────────────────────────────────────────
// 케이스 13: 화물 + isRefrigerated, cargoDetail 없음
// ─────────────────────────────────────────────

describe("화물 + isRefrigerated, cargoDetail 없음", () => {
  it("냉장 차량은 cargoDetail 없어도 +25 냉장 가점이 적용된다 (score=70)", () => {
    // base(50) + 냉장(+25) + mileage20k 연비<12(-5) = 70
    const input: ScoreInput = {
      industry: "개인",
      preferences: ["화물"],
      annualMileage: 20000,
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, isRefrigerated: true };
    const ctx: ScoreCtx = { category: "밴", price: 30_000_000, fuelEfficiency: 10 };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBe(70);
  });
});

// ─────────────────────────────────────────────
// 케이스 14: 거주지역 가점
// ─────────────────────────────────────────────

describe("거주지역 가점", () => {
  it("강원·산간 + AWD 차량이면 +15", () => {
    const inputRegion: ScoreInput = { ...BASE_INPUT, residenceRegion: "강원·산간" };
    const inputNone: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, isAwd: true };
    const ctx: ScoreCtx = { ...BASE_CTX };

    expect(
      scoreVehicle(inputRegion, attrs, ctx).score - scoreVehicle(inputNone, attrs, ctx).score
    ).toBe(15);
  });

  it("제주 + EV이면 +20", () => {
    const inputJeju: ScoreInput = { ...BASE_INPUT, residenceRegion: "제주" };
    const inputNone: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { ...BASE_CTX };

    expect(
      scoreVehicle(inputJeju, attrs, ctx).score - scoreVehicle(inputNone, attrs, ctx).score
    ).toBe(20);
  });
});
