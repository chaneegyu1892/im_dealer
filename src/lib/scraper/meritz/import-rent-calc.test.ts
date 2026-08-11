import { describe, it, expect } from "vitest";
import { computeMonthlyImportRent, computeImportAcqCost, type MeritzImportTrim, type MeritzImportConstants } from "./import-rent-calc";

// 검증 기준: 배포 엑셀(수입차 렌트 2607.v1)의 선택차 캐시값 원단위 대조.
// Model Y L AWD <지원금>, 기본가격 45,000,000, 특판할인액 2,100,000, EV(개소세 1.1), 전략E(6%), 잔가군 P.
// 견적조건 H21=39,431,000 · 렌트_입력 EG14 캐시 36/48/60 = 774,400/700,500/654,400 → 월렌트료 851,840/770,550/719,840.
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

describe("meritz import rent calculator", () => {
  it("취득원가(H21) 재현 = 39,431,000", () => {
    expect(Math.round(computeImportAcqCost(MODEL_Y, 45000000))).toBe(39431000);
  });
  it("36개월/2만km 월렌트료 = 851,840", () => {
    expect(computeMonthlyImportRent(MODEL_Y, 45000000, 36, 20000, CONSTS)).toBe(851840);
  });
  it("48개월/2만km 월렌트료 = 770,550", () => {
    expect(computeMonthlyImportRent(MODEL_Y, 45000000, 48, 20000, CONSTS)).toBe(770550);
  });
  it("60개월/2만km 월렌트료 = 719,840", () => {
    expect(computeMonthlyImportRent(MODEL_Y, 45000000, 60, 20000, CONSTS)).toBe(719840);
  });
  it("잔가율 없는 셀은 null", () => {
    expect(computeMonthlyImportRent(MODEL_Y, 45000000, 36, 40000, CONSTS)).toBeNull();
  });
  it("보증금 10% 월렌트료는 기본보다 낮다", () => {
    const base = computeMonthlyImportRent(MODEL_Y, 45000000, 36, 20000, CONSTS)!;
    const dep = computeMonthlyImportRent(MODEL_Y, 45000000, 36, 20000, CONSTS, { depositRate: 0.1 })!;
    expect(dep).toBeGreaterThan(0);
    expect(dep).toBeLessThan(base);
  });
  it("선납 10% 월렌트료는 기본 대비 최소 선납렌트료(선납금/기간)만큼 낮다", () => {
    const base = computeMonthlyImportRent(MODEL_Y, 45000000, 36, 20000, CONSTS)!;
    const pre = computeMonthlyImportRent(MODEL_Y, 45000000, 36, 20000, CONSTS, { prepayRate: 0.1 })!;
    const prepayMonthly = Math.floor(4500000 / 36 / 10) * 10; // ROUNDDOWN(CC20/n, -1)
    expect(pre).toBeGreaterThan(0);
    expect(pre).toBeLessThanOrEqual(base - prepayMonthly);
  });
});
