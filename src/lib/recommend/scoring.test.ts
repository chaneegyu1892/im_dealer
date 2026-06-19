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
  purpose: "출퇴근·업무용",
  annualMileage: 20000,
};

const BASE_CTX: ScoreCtx = {
  category: "세단",
  price: 35_000_000,
  fuelEfficiency: 10,
};

// ─────────────────────────────────────────────
// 케이스 1: 법인 + EV SUV (price 50M)
// 기대: score >= 50(base) + 18(SUV프리미엄) + 15(EV법인)
// ─────────────────────────────────────────────

describe("법인 + EV SUV 50M", () => {
  it("score는 base 50 + SUV 프리미엄 18 + EV 15 이상이어야 한다", () => {
    const input: ScoreInput = { ...BASE_INPUT, industry: "법인", purpose: "출퇴근·업무용" };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { category: "SUV", price: 50_000_000, fuelEfficiency: null };

    const { score } = scoreVehicle(input, attrs, ctx);

    // base(50) + SUV프리미엄(18) + EV법인(15) + EV출퇴근(15) = 최소 98
    expect(score).toBeGreaterThanOrEqual(50 + 18 + 15);
  });

  it("EV 법인 차량에는 EV 관련 reason이 포함되어야 한다", () => {
    const input: ScoreInput = { ...BASE_INPUT, industry: "법인", purpose: "출퇴근·업무용" };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { category: "SUV", price: 50_000_000, fuelEfficiency: null };

    const { reasons } = scoreVehicle(input, attrs, ctx);

    expect(reasons.some((r) => r.includes("전기차") || r.includes("취득세") || r.includes("EV"))).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 케이스 2: 가정용 영유아 + 슬라이딩도어 SUV
// ─────────────────────────────────────────────

describe("가정용 영유아 + 슬라이딩도어 SUV", () => {
  it("슬라이딩 도어 관련 reason이 포함되어야 한다", () => {
    const input: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인",
      purpose: "가정용",
      purposeDetail: "영유아",
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, hasSlidingDoor: true };
    const ctx: ScoreCtx = { category: "SUV", price: 35_000_000, fuelEfficiency: null };

    const { reasons } = scoreVehicle(input, attrs, ctx);

    expect(reasons.some((r) => r.includes("슬라이딩"))).toBe(true);
  });

  it("score는 BASE_SCORE(50)보다 커야 한다", () => {
    const input: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인",
      purpose: "가정용",
      purposeDetail: "영유아",
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, hasSlidingDoor: true };
    const ctx: ScoreCtx = { category: "SUV", price: 35_000_000, fuelEfficiency: null };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBeGreaterThan(50);
  });

  it("SUV 영유아: 가정용 SUV +15, 영유아 SUV +20, 슬라이딩 +15 = 50+15+20+15=100", () => {
    const input: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인",
      purpose: "가정용",
      purposeDetail: "영유아",
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, hasSlidingDoor: true };
    const ctx: ScoreCtx = { category: "SUV", price: 35_000_000, fuelEfficiency: null };

    const { score } = scoreVehicle(input, attrs, ctx);

    // base(50) + 가정용SUV(15) + 영유아SUV(20) + 슬라이딩(15) = 100
    expect(score).toBe(100);
  });
});

// ─────────────────────────────────────────────
// 케이스 3: 화물·배달 + 대형 화물 + cargoKg 1000
// ─────────────────────────────────────────────

describe("화물·배달 + 대형 화물 + cargoKg 1000", () => {
  it("+25 (1톤급) 가점이 반영되어야 한다", () => {
    const input: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인사업자",
      purpose: "화물·배달",
      purposeDetail: "대형 화물",
    };
    const attrs: VehicleAttrs = {
      ...BASE_ATTRS,
      cargoKg: 1000,
      fuel: "디젤",
    };
    const ctx: ScoreCtx = { category: "트럭", price: 30_000_000, fuelEfficiency: 12 };

    const { score, reasons } = scoreVehicle(input, attrs, ctx);

    // base(50) + 개인사업자밴트럭(10) + 화물1톤(25) + 디젤mileage(없음) = 최소 85
    expect(score).toBeGreaterThanOrEqual(50 + 25);
    expect(reasons.some((r) => r.includes("1톤급"))).toBe(true);
  });

  it("1500kg 이상이면 +30 (대형 적재) 가점을 받아야 한다", () => {
    const input: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인사업자",
      purpose: "화물·배달",
      purposeDetail: "대형 화물",
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
      purpose: "임원용·의전",
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
    const ctx: ScoreCtx = {
      category: "세단",
      price: 80_000_000,
      fuelEfficiency: 20,
    };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBeLessThanOrEqual(250);
  });
});

// ─────────────────────────────────────────────
// 케이스 5: 출퇴근·업무용 + 트럭 → -15 반영
// ─────────────────────────────────────────────

describe("출퇴근·업무용 + 트럭 패널티", () => {
  it("트럭은 출퇴근 목적에서 -15 패널티를 받아야 한다", () => {
    const baselineInput: ScoreInput = { ...BASE_INPUT, purpose: "출퇴근·업무용" };
    const truckInput: ScoreInput = { ...BASE_INPUT, purpose: "출퇴근·업무용" };

    const attrs: VehicleAttrs = { ...BASE_ATTRS };

    const baselineCtx: ScoreCtx = { category: "세단", price: 35_000_000, fuelEfficiency: 10 };
    const truckCtx: ScoreCtx = { category: "트럭", price: 35_000_000, fuelEfficiency: 10 };

    const baselineScore = scoreVehicle(baselineInput, attrs, baselineCtx).score;
    const truckScore = scoreVehicle(truckInput, attrs, truckCtx).score;

    // 세단은 +8, 트럭은 -15 → 차이는 최소 23
    expect(baselineScore - truckScore).toBeGreaterThanOrEqual(23);
  });

  it("트럭 목적 점수가 세단보다 낮아야 한다", () => {
    const input: ScoreInput = { ...BASE_INPUT, purpose: "출퇴근·업무용" };
    const attrs: VehicleAttrs = { ...BASE_ATTRS };

    const sedanCtx: ScoreCtx = { category: "세단", price: 35_000_000, fuelEfficiency: null };
    const truckCtx: ScoreCtx = { category: "트럭", price: 35_000_000, fuelEfficiency: null };

    const sedanScore = scoreVehicle(input, attrs, sedanCtx).score;
    const truckScore = scoreVehicle(input, attrs, truckCtx).score;

    expect(truckScore).toBeLessThan(sedanScore);
  });
});

// ─────────────────────────────────────────────
// 케이스 6: nearestMileage — 22000 → 20000 규칙 적용
// ─────────────────────────────────────────────

describe("nearestMileage: 22000 → 20000 규칙 적용", () => {
  it("22000km는 20000 규칙 버킷을 사용해야 한다", () => {
    // 20000 규칙: fuelEfficiency >= 15 → +10
    // 만약 30000 규칙이 적용됐다면 fuelEfficiency >= 15 → +15
    const input20: ScoreInput = { ...BASE_INPUT, annualMileage: 20000 };
    const input22: ScoreInput = { ...BASE_INPUT, annualMileage: 22000 };
    const attrs: VehicleAttrs = { ...BASE_ATTRS };
    const ctx: ScoreCtx = { category: "세단", price: 35_000_000, fuelEfficiency: 16 };

    const score20 = scoreVehicle(input20, attrs, ctx).score;
    const score22 = scoreVehicle(input22, attrs, ctx).score;

    // 같은 20000 버킷을 사용해야 동일한 점수
    expect(score22).toBe(score20);
  });

  it("28000km는 30000 버킷을 사용해야 한다 (20000 버킷과 다른 점수)", () => {
    const input20: ScoreInput = { ...BASE_INPUT, annualMileage: 20000 };
    const input28: ScoreInput = { ...BASE_INPUT, annualMileage: 28000 };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { category: "SUV", price: 50_000_000, fuelEfficiency: 5 };

    const score20 = scoreVehicle(input20, attrs, ctx).score;
    const score28 = scoreVehicle(input28, attrs, ctx).score;

    // 30000 버킷: EV +20. 20000 버킷: EV 없음 (단지 하이브리드)
    expect(score28).not.toBe(score20);
  });
});

// ─────────────────────────────────────────────
// 추가 케이스: 충전환경 가점
// ─────────────────────────────────────────────

describe("충전환경 가점 (EV + 전기차 선호 시)", () => {
  it("자택 충전이면 +20 가점이 있어야 한다", () => {
    const inputWithCharging: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인",
      purpose: "출퇴근·업무용",
      fuelPreference: "전기차",
      chargingEnvironment: "자택",
    };
    const inputNoCharging: ScoreInput = {
      ...BASE_INPUT,
      industry: "개인",
      purpose: "출퇴근·업무용",
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
// 추가 케이스: 연료 선호 일치/불일치
// ─────────────────────────────────────────────

describe("연료 선호 일치/불일치", () => {
  it("선호 연료와 차량 연료 일치 시 +10", () => {
    const inputMatch: ScoreInput = {
      ...BASE_INPUT,
      fuelPreference: "하이브리드",
    };
    const inputNoPreference: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "하이브리드" };
    const ctx: ScoreCtx = { ...BASE_CTX };

    const scoreMatch = scoreVehicle(inputMatch, attrs, ctx).score;
    const scoreNone = scoreVehicle(inputNoPreference, attrs, ctx).score;

    expect(scoreMatch - scoreNone).toBe(10);
  });

  it("선호 연료와 차량 연료 불일치 시 -5", () => {
    const inputMismatch: ScoreInput = {
      ...BASE_INPUT,
      fuelPreference: "전기차",
    };
    const inputNoPreference: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "가솔린" };
    const ctx: ScoreCtx = { ...BASE_CTX };

    const scoreMismatch = scoreVehicle(inputMismatch, attrs, ctx).score;
    const scoreNone = scoreVehicle(inputNoPreference, attrs, ctx).score;

    expect(scoreMismatch - scoreNone).toBe(-5);
  });

  it("상관없음 선택 시 가감 없음", () => {
    const inputDontCare: ScoreInput = {
      ...BASE_INPUT,
      fuelPreference: "상관없음",
    };
    const inputNoPreference: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "가솔린" };
    const ctx: ScoreCtx = { ...BASE_CTX };

    const scoreDontCare = scoreVehicle(inputDontCare, attrs, ctx).score;
    const scoreNone = scoreVehicle(inputNoPreference, attrs, ctx).score;

    expect(scoreDontCare).toBe(scoreNone);
  });
});

// ─────────────────────────────────────────────
// Fix 5 케이스: 게이팅 브랜치 테스트
// ─────────────────────────────────────────────

describe("임원용·의전 + compact 차량 이중 패널티", () => {
  it("price 20M compact 세단은 -15와 -25 모두 적용되어 score가 5이어야 한다", () => {
    // base(50) + price<OFFICIAL_MIN(-15) + isCompact(-25) + mileage20k연비패널티(-5) = 5
    const input: ScoreInput = {
      industry: "개인",
      purpose: "임원용·의전",
      annualMileage: 20000,
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS };
    const ctx: ScoreCtx = { category: "세단", price: 20_000_000, fuelEfficiency: 10 };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBe(5);
  });
});

describe("가정용 purposeDetail 없으면 CHILD_RULES 미적용", () => {
  it("SUV 가정용 purposeDetail 없으면 PURPOSE_RULES 가정용 SUV+15만 반영하여 score=65", () => {
    // base(50) + 가정용SUV(+15) + mileage10k compact아님(0) = 65
    const input: ScoreInput = {
      industry: "개인",
      purpose: "가정용",
      annualMileage: 10000,
      // purposeDetail 없음 → CHILD_RULES 미적용
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS };
    const ctx: ScoreCtx = { category: "SUV", price: 35_000_000, fuelEfficiency: null };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBe(65);
  });
});

describe("화물·배달 + isRefrigerated, purposeDetail 없음", () => {
  it("냉장 차량은 purposeDetail 없어도 +25 냉장 가점이 적용된다 (score=70)", () => {
    // base(50) + PURPOSE_RULES["화물·배달"]=[] + mileage20k연비패널티(-5) + 냉장(+25) = 70
    const input: ScoreInput = {
      industry: "개인",
      purpose: "화물·배달",
      annualMileage: 20000,
      // purposeDetail 없음
    };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, isRefrigerated: true };
    const ctx: ScoreCtx = { category: "밴", price: 30_000_000, fuelEfficiency: 10 };

    const { score } = scoreVehicle(input, attrs, ctx);

    expect(score).toBe(70);
  });
});

// ─────────────────────────────────────────────
// 추가 케이스: 거주지역 가점
// ─────────────────────────────────────────────

describe("거주지역 가점", () => {
  it("강원·산간 + AWD 차량이면 +15", () => {
    const inputRegion: ScoreInput = {
      ...BASE_INPUT,
      residenceRegion: "강원·산간",
    };
    const inputNoRegion: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, isAwd: true };
    const ctx: ScoreCtx = { ...BASE_CTX };

    const scoreRegion = scoreVehicle(inputRegion, attrs, ctx).score;
    const scoreNone = scoreVehicle(inputNoRegion, attrs, ctx).score;

    expect(scoreRegion - scoreNone).toBe(15);
  });

  it("제주 + EV이면 +20", () => {
    const inputJeju: ScoreInput = {
      ...BASE_INPUT,
      residenceRegion: "제주",
    };
    const inputNoRegion: ScoreInput = { ...BASE_INPUT };
    const attrs: VehicleAttrs = { ...BASE_ATTRS, fuel: "EV" };
    const ctx: ScoreCtx = { ...BASE_CTX };

    const scoreJeju = scoreVehicle(inputJeju, attrs, ctx).score;
    const scoreNone = scoreVehicle(inputNoRegion, attrs, ctx).score;

    expect(scoreJeju - scoreNone).toBe(20);
  });
});
