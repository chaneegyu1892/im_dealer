/**
 * 견적 계산 엔진 자동 검증 스크립트
 *
 * 시드와 동일한 회수율/가산율 설정으로 다양한 시나리오를 돌려 결과를 표로 출력.
 * 각 케이스는 이론적 기대값과 함께 표시해 눈으로 즉시 비교 가능.
 *
 * 실행: npx tsx scripts/diag/quote-verification.ts
 */

import {
  calculateMultiFinanceQuote,
  calcDepositDiscountRate,
  calcPrepayAdjustRate,
  type CalcInput,
  type RateConfigData,
} from "../../src/lib/quote-calculator";
import type { RateSheetRaw } from "../../src/types/admin";

// ─── 헬퍼 ──────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function row(label: string, value: number, expected?: string): string {
  const v = fmt(value).padStart(12);
  const e = expected ? `  (기대: ${expected})` : "";
  return `  ${label.padEnd(28)} ${v}원${e}`;
}

// ─── 시드와 동일한 회수율 설정 (오릭스 × 쏘렌토 HEV 가정) ──────────

const baseConfig: RateConfigData = {
  financeCompanyId: "fc_test",
  financeCompanyName: "테스트캐피탈",
  financeSurchargeRate: 0,
  minVehiclePrice: 43_840_000,
  maxVehiclePrice: 49_290_000,
  // 시드의 SORENTO HEV 기준 (실 명세 회수율)
  minRateMatrix: {
    "36_10000": 0.012325, "36_20000": 0.013337, "36_30000": 0.013993,
    "48_10000": 0.012726, "48_20000": 0.012506, "48_30000": 0.013682,
    "60_10000": 0.012110, "60_20000": 0.012181, "60_30000": 0.012997,
  },
  maxRateMatrix: {
    "36_10000": 0.012634, "36_20000": 0.013695, "36_30000": 0.014395,
    "48_10000": 0.012914, "48_20000": 0.012841, "48_30000": 0.013986,
    "60_10000": 0.012236, "60_20000": 0.012406, "60_30000": 0.013126,
  },
  depositDiscountRate: -0.000523, // 음수 = 할인
  prepayAdjustRate: -0.000073,    // 새 컨벤션: 음수 = 할인
};

function baseInput(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    vehiclePrice: 43_840_000,
    contractMonths: 48,
    annualMileage: 20000,
    depositRate: 0,
    prepayRate: 0,
    vehicleSurchargeRate: 0,
    rankSurchargeRates: [1.0, 1.5, 2.0, 2.5],
    rateConfigs: [baseConfig],
    ...overrides,
  };
}

// ─── 시나리오 ──────────────────────────────────────────

function scenarioA_basic() {
  console.log("\n━━━━━━━━━━ [A] 기본 견적 (보증금/선납금 0, 가산 0) ━━━━━━━━━━");
  const r = calculateMultiFinanceQuote(baseInput())[0];
  console.log(`  차량가 43,840,000 / 48개월 / 2만km / 회수율 ${(0.012506 * 100).toFixed(4)}%`);
  console.log(row("기준 월대여료 (baseMonthly)", r.breakdown.baseMonthly,
    `${fmt(Math.round(43_840_000 * 0.012506))}원 (= 차량가 × 회수율)`));
  console.log(row("최종 월대여료", r.monthlyPayment, "가산 0이므로 baseMonthly 와 같음"));
}

function scenarioB_deposit() {
  console.log("\n━━━━━━━━━━ [B] 보증금 적용 (음수 = 할인) ━━━━━━━━━━");
  for (const dr of [10, 20, 30]) {
    const r = calculateMultiFinanceQuote(baseInput({ depositRate: dr, contractMonths: 36, annualMileage: 20000 }))[0];
    const adjusted = 0.013337 + (-0.000523) * (dr / 10);
    const expected = Math.round(43_840_000 * adjusted);
    console.log(row(`보증금 ${dr}% / 36개월`, r.baseMonthly,
      `${fmt(expected)}원 (회수율 ${(adjusted * 100).toFixed(4)}%)`));
  }
}

function scenarioC_prepay_discount() {
  console.log("\n━━━━━━━━━━ [C] 선납금 적용 — 음수 prepayAdjustRate (할인) ━━━━━━━━━━");
  // 36개월/1만km 회수율 = min·max 보간. vehiclePrice == minVehiclePrice 이므로 minRate 그대로 사용 (0.012325)
  const rate = 0.012325;
  const base = 43_840_000 * rate;
  console.log(`  기준 월대여료 (가산 전): ${fmt(Math.round(base))}원 (43,840,000 × ${(rate * 100).toFixed(4)}%)`);
  for (const pr of [10, 20, 30]) {
    const r = calculateMultiFinanceQuote(baseInput({ prepayRate: pr, contractMonths: 36, annualMileage: 10000 }))[0];
    const prepayDeduction = (43_840_000 * pr / 100) / 36;
    const adjust = 43_840_000 * (-0.000073) * (pr / 10);
    const expected = Math.round(base - prepayDeduction + adjust);
    console.log(row(`선납금 ${pr}% / 36개월`, r.baseMonthly,
      `${fmt(expected)}원 (할인 ${fmt(Math.round(-adjust))}원 + 분할 ${fmt(Math.round(prepayDeduction))}원)`));
  }
}

function scenarioD_prepay_surcharge() {
  console.log("\n━━━━━━━━━━ [D] 선납금 양수 — 가산 동작 확인 (정책 검증) ━━━━━━━━━━");
  const config = { ...baseConfig, prepayAdjustRate: 0.0002 }; // 임의 양수
  const r = calculateMultiFinanceQuote({
    ...baseInput({ prepayRate: 30, contractMonths: 48, annualMileage: 20000 }),
    rateConfigs: [config],
  })[0];
  const base = 43_840_000 * 0.012506;
  const prepayDeduction = (43_840_000 * 30 / 100) / 48;
  const adjust = 43_840_000 * 0.0002 * 3;
  const expected = Math.round(base - prepayDeduction + adjust);
  console.log(row("선납금 30% / 양수 0.0002", r.baseMonthly,
    `${fmt(expected)}원 (가산 +${fmt(Math.round(adjust))}원)`));
  console.log("  ※ prepayAdjustRate 가 양수면 가산으로 동작해야 정상");
}

function scenarioE_customer_spec() {
  console.log("\n━━━━━━━━━━ [E] 고객 명세 예시 — 5천만 / 48개월 / 1% 가산 ━━━━━━━━━━");
  const config: RateConfigData = {
    financeCompanyId: "fc_custom",
    financeCompanyName: "테스트",
    financeSurchargeRate: 0,
    minVehiclePrice: 50_000_000,
    maxVehiclePrice: 50_000_000,
    minRateMatrix: { "36_10000": 0.01, "36_20000": 0.01, "36_30000": 0.01,
                     "48_10000": 0.01, "48_20000": 0.01, "48_30000": 0.01,
                     "60_10000": 0.01, "60_20000": 0.01, "60_30000": 0.01 },
    maxRateMatrix: { "36_10000": 0.01, "36_20000": 0.01, "36_30000": 0.01,
                     "48_10000": 0.01, "48_20000": 0.01, "48_30000": 0.01,
                     "60_10000": 0.01, "60_20000": 0.01, "60_30000": 0.01 },
    depositDiscountRate: 0,
    prepayAdjustRate: 0,
  };
  const r = calculateMultiFinanceQuote({
    vehiclePrice: 50_000_000,
    contractMonths: 48,
    annualMileage: 20000,
    depositRate: 0,
    prepayRate: 0,
    vehicleSurchargeRate: 1, // 1% 가산
    rankSurchargeRates: [0],
    rateConfigs: [config],
  })[0];
  console.log(row("기본 월대여료", r.baseMonthly, "500,000원"));
  console.log(row("차량 가산 월 추가금", r.surcharges.vehicleSurcharge,
    "10,417원 (= 50M × 1% ÷ 48)"));
  console.log(row("최종 월대여료", r.monthlyPayment, "510,417원 ⭐ 고객 명세값"));
}

function scenarioF_multi_finance_ranking() {
  console.log("\n━━━━━━━━━━ [F] 다중 금융사 + 순위/차량/금융사 가산 합산 ━━━━━━━━━━");
  const configs: RateConfigData[] = [
    { ...baseConfig, financeCompanyId: "f1", financeCompanyName: "A캐피탈", financeSurchargeRate: 0 },
    { ...baseConfig, financeCompanyId: "f2", financeCompanyName: "B캐피탈", financeSurchargeRate: 0.2,
      minRateMatrix: { ...baseConfig.minRateMatrix, "48_20000": 0.013 },
      maxRateMatrix: { ...baseConfig.maxRateMatrix, "48_20000": 0.013 } },
    { ...baseConfig, financeCompanyId: "f3", financeCompanyName: "C캐피탈", financeSurchargeRate: 0.5,
      minRateMatrix: { ...baseConfig.minRateMatrix, "48_20000": 0.0135 },
      maxRateMatrix: { ...baseConfig.maxRateMatrix, "48_20000": 0.0135 } },
  ];
  const results = calculateMultiFinanceQuote({
    ...baseInput({ contractMonths: 48, annualMileage: 20000, vehicleSurchargeRate: 0.3 }),
    rateConfigs: configs,
  });

  console.log("  차량가 43,840,000 / 48개월 / 2만km / 차량가산 0.3%");
  console.log("");
  console.log("  순위 캐피탈          기준     순위가산  차량가산  금융사가산  최종");
  console.log("  ──── ──────────── ────────── ──────── ──────── ────────── ──────────");
  results.forEach((r) => {
    const rank = String(r.rank).padEnd(4);
    const name = r.financeCompanyName.padEnd(12);
    const base = fmt(Math.round(r.baseMonthly)).padStart(9);
    const rs = fmt(r.surcharges.rankSurcharge).padStart(7);
    const vs = fmt(r.surcharges.vehicleSurcharge).padStart(7);
    const fs = fmt(r.surcharges.financeSurcharge).padStart(8);
    const mp = fmt(r.monthlyPayment).padStart(9);
    console.log(`  ${rank} ${name} ${base}  ${rs}  ${vs}  ${fs}  ${mp}`);
  });
  console.log("  ※ 순위/차량/금융사 가산이 차량가 기준 합산 공식으로 적용");
}

function scenarioG_admin_helper_sign() {
  console.log("\n━━━━━━━━━━ [G] 어드민 자동 산출 헬퍼 부호 검증 ━━━━━━━━━━");
  console.log("  운영자가 캐피탈 견적표를 입력 → calcDepositDiscountRate / calcPrepayAdjustRate 가");
  console.log("  올바른 부호로 산출하는지 확인 (이게 양수면 API 차단 발동).");

  const VP = 50_000_000;
  const baseMonthly = VP * 0.012506; // 약 625,300원
  const make = (m: number): RateSheetRaw => ({
    "36_10000": m, "36_20000": m, "36_30000": m,
    "48_10000": m, "48_20000": m, "48_30000": m,
    "60_10000": m, "60_20000": m, "60_30000": m,
  });

  // (1) 정상 보증금 입력 (dep < base) → 음수
  const depDiscount = calcDepositDiscountRate(
    make(baseMonthly),
    make(baseMonthly - 25_000), // 보증금 적용 시 25,000원 할인
    VP,
  );
  console.log(`  보증금 정상 (할인) :  ${depDiscount.toFixed(6)}  ${depDiscount < 0 ? "✅ 음수 → 정상 할인" : "❌ 양수 → 가산처럼 동작"}`);

  // (2) 잘못된 보증금 입력 (dep > base) → 양수 → API 차단되어야 함
  const depWrong = calcDepositDiscountRate(
    make(baseMonthly),
    make(baseMonthly + 25_000),
    VP,
  );
  console.log(`  보증금 비정상(가산):  ${depWrong.toFixed(6)}  ${depWrong > 0 ? "✅ 양수 → API 400 차단 발동" : "❌ 음수 → 차단 안 됨"}`);

  // (3) 선납금 할인 → 음수
  const prepayDiscount = calcPrepayAdjustRate(
    make(baseMonthly),
    (() => {
      const sheet: RateSheetRaw = {} as RateSheetRaw;
      for (const k of ["36_10000","36_20000","36_30000","48_10000","48_20000","48_30000","60_10000","60_20000","60_30000"] as const) {
        const months = Number(k.split("_")[0]);
        const deduction = (VP * 0.1) / months;
        sheet[k] = baseMonthly - deduction - 3_500;
      }
      return sheet;
    })(),
    VP,
  );
  console.log(`  선납금 할인        :  ${prepayDiscount.toFixed(6)}  ${prepayDiscount < 0 ? "✅ 음수 → 정상 할인" : "❌ 양수 → 가산"}`);
}

// ─── 실행 ──────────────────────────────────────────────

console.log("================================================================");
console.log("  견적 계산 엔진 자동 검증 — 새 공식 (가산 합산 + 부호 컨벤션)");
console.log("================================================================");
scenarioA_basic();
scenarioB_deposit();
scenarioC_prepay_discount();
scenarioD_prepay_surcharge();
scenarioE_customer_spec();
scenarioF_multi_finance_ranking();
scenarioG_admin_helper_sign();
console.log("\n================================================================");
console.log("  모든 시나리오 완료. 각 케이스의 결과값과 기대값을 비교하세요.");
console.log("================================================================\n");
