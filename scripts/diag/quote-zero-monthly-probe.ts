/**
 * [진단 전용] "월 납입금 0만원" 서버측 배제 프로브.
 *
 * 메리츠 수입차 렌터카(테슬라) 엑셀 파이프라인 전 구간을 리포 내 코드로 재현해,
 * 공개 결과 조건(선납 30% · 60개월 · 연 2만km)에서 월납입금이 0/음수가 될 수 있는지 확인한다.
 *
 *   computeMonthlyImportRent(픽스처) → ingest 샘플(보증금/선납 10%) →
 *   buildCollectedRateData → calcRateMatrix → calculateMultiFinanceQuote(3시나리오)
 *
 * 결론(2026-08-16): 어떤 현실적 차량가에서도 aggressive(선납 30%)는 46만~53만원대 양수.
 * 라이브 DB 스캔(활성 시트 39,858셀 × 1,278트림)에서도 선납 30% 월납 ≤ 0 은 0건 —
 * 0만원은 계산/데이터 문제가 아니라 클라이언트 렌더링(잠금 시나리오 노출) 문제다.
 *
 * 실행: npx tsx scripts/diag/quote-zero-monthly-probe.ts
 */

import {
  computeMonthlyImportRent,
  type MeritzImportTrim,
  type MeritzImportConstants,
} from "../../src/lib/scraper/meritz/import-rent-calc";
import { buildCollectedRateData } from "../../src/lib/scraper/rate-matrices";
import {
  calcRateMatrix,
  calculateMultiFinanceQuote,
  type RateConfigData,
} from "../../src/lib/quote-calculator";
import { SCENARIO_CONDITIONS, RANK_SURCHARGE_RATES } from "../../src/constants/quote-defaults";
import type { RateSheetRaw } from "../../src/types/admin";

const CELLS = [
  [36, 10000], [36, 20000], [36, 30000],
  [48, 10000], [48, 20000], [48, 30000],
  [60, 10000], [60, 20000], [60, 30000],
] as const;

// 리포 픽스처(import-rent-calc.test.ts) — Model Y L AWD <지원금>, 엑셀 원단위 검증 완료 값.
const MODEL_Y: MeritzImportTrim = {
  manufacturer: "TESLA", name: "Model Y L AWD <지원금>",
  gaesoseK: 1.1, strategy: "전략E", fuel: "EV", disp: 0,
  discountAmt: 2100000, discountExtraRate: 0, rvGroup: "P",
  residual: {
    "36_10000": 0.59, "36_20000": 0.57, "36_30000": 0.56,
    "48_10000": 0.54, "48_20000": 0.52, "48_30000": 0.46,
    "60_10000": 0.49, "60_20000": 0.47, "60_30000": 0.30,
  },
  irrAdj: {},
  maintMonthly: 106000, deliveryFeeSeoul: 143000, bigWash: false, evSubsidy: 0,
};
const CONSTS: MeritzImportConstants = { strategyBaseRate: { 전략E: 0.06, 일반: 0.0525 } };

function run(label: string, trim: MeritzImportTrim, price: number) {
  // 1) ingest 단계 재현 (import-rent-ingest.ts 와 동일 로직)
  const baseRates: Record<string, number> = {};
  for (const [m, d] of CELLS) {
    const v = computeMonthlyImportRent(trim, price, m, d, CONSTS);
    if (v && v > 0) baseRates[`${m}_${d}`] = v;
  }
  let dep: number | undefined;
  let pre: number | undefined;
  if (baseRates["36_10000"]) {
    const dv = computeMonthlyImportRent(trim, price, 36, 10000, CONSTS, { depositRate: 0.1 });
    if (dv && dv > 0) dep = dv;
    const pv = computeMonthlyImportRent(trim, price, 36, 10000, CONSTS, { prepayRate: 0.1 });
    if (pv && pv > 0) pre = pv;
  }
  // 2) apply-catalog 단계 재현
  const collected = buildCollectedRateData(baseRates, price, dep, pre);
  const rateMatrix = calcRateMatrix(collected.baseRates as RateSheetRaw, price);

  const cfg: RateConfigData = {
    financeCompanyId: "meritz", financeCompanyName: "메리츠캐피탈",
    financeSurchargeRate: 0,
    minVehiclePrice: price, maxVehiclePrice: price,
    minRateMatrix: rateMatrix, maxRateMatrix: rateMatrix,
    depositDiscountRate: collected.depositDiscountRate,
    prepayAdjustRate: collected.prepayAdjustRate,
  };

  console.log(`\n=== ${label} (차량가 ${price.toLocaleString("ko-KR")}원) ===`);
  console.log(`  depositDiscountRate=${collected.depositDiscountRate}  prepayAdjustRate=${collected.prepayAdjustRate}`);
  console.log(`  회수율 60_20000=${rateMatrix["60_20000"]}`);

  // 3) 견적 API 시나리오 재현 (60개월 · 연 2만km · 반납형 · 차량가산 0)
  for (const key of ["conservative", "standard", "aggressive"] as const) {
    const { depositRate, prepayRate } = SCENARIO_CONDITIONS[key];
    const results = calculateMultiFinanceQuote({
      vehiclePrice: price, contractMonths: 60, annualMileage: 20000,
      depositRate, prepayRate, vehicleSurchargeRate: 0,
      rankSurchargeRates: [...RANK_SURCHARGE_RATES], rateConfigs: [cfg],
    });
    const best = results[0];
    const monthly = best ? best.monthlyPayment : 0;
    const flag = monthly <= 0 ? "  ⚠️ 0/음수!" : "";
    console.log(
      `  ${key.padEnd(12)} (보증 ${depositRate}% / 선납 ${prepayRate}%): 월 ${monthly.toLocaleString("ko-KR")}원${flag}`,
    );
  }
}

console.log("──────────────────────────────────────────────────────");
console.log(" 월 납입금 0만원 진단 프로브 — 메리츠 수입차 파이프라인 전 구간");
console.log("──────────────────────────────────────────────────────");
run("픽스처 원본", MODEL_Y, 45_000_000);
run("New Model Y Premium RWD 가격대", MODEL_Y, 49_990_000);
run("Model Y RWD 가격대", MODEL_Y, 52_990_000);
console.log("\n※ 모든 가격대에서 aggressive(선납 30%)가 뚜렷한 양수면 서버 계산·데이터 경로는 배제된다.");
