import { describe, it, expect } from "vitest";
import { computeMonthlyRent, computePV, type MeritzTrim, type MeritzConstants } from "./calc";

// 검증 기준: 배포 엑셀(렌터카 2607.v2)의 선택차 캐시값 원단위 대조.
// 26MY 디 올 뉴 싼타페 1.6 HEV 2WD, 판매가 35,000,000, 전략AA, 개소세 1.15863, HEV 1598cc.
const SANTA: MeritzTrim = {
  manufacturer: "현대", name: "[Select 프로모션] 26MY 디 올 뉴 싼타페 1.6 HEV 2WD",
  gaesoseK: 1.15863, insGrade: "RV", strategy: "전략AA", fuel: "하이브리드", disp: 1598,
  mfrDiscount: 0.07, rvGroup: "7",
  residual: { "36_20000": 0.7, "48_20000": 0.64, "60_20000": 0.59 },
  irrAdj: { "60_20000": 0.005 }, // 60개월 IRR조정(전략AA 0.052 → 0.057)
  deliveryFeeSeoul: 226000, evSubsidy: 0,
};
const CONSTS: MeritzConstants = { strategyBaseRate: { "전략AA": 0.052 } };

describe("meritz rent calculator", () => {
  it("취득원가 PV 재현", () => {
    expect(Math.round(computePV(SANTA, 35000000))).toBe(29707509);
  });
  it("36개월/2만km 보증0 = 478,060", () => {
    expect(computeMonthlyRent(SANTA, 35000000, 36, 20000, CONSTS)).toBe(478060);
  });
  it("48개월/2만km 보증0 = 455,400", () => {
    expect(computeMonthlyRent(SANTA, 35000000, 48, 20000, CONSTS)).toBe(455400);
  });
  it("60개월/2만km 보증40% = 376,750", () => {
    expect(computeMonthlyRent(SANTA, 35000000, 60, 20000, CONSTS, { depositRate: 0.4 })).toBe(376750);
  });
  it("잔가율 없는 셀은 null", () => {
    expect(computeMonthlyRent(SANTA, 35000000, 36, 30000, CONSTS)).toBeNull();
  });
  it("보증금 10% 월납입금은 기본보다 낮다 (카탈로그 보증금 샘플의 할인 부호 전제)", () => {
    const base = computeMonthlyRent(SANTA, 35000000, 36, 20000, CONSTS)!;
    const dep = computeMonthlyRent(SANTA, 35000000, 36, 20000, CONSTS, { depositRate: 0.1 })!;
    expect(dep).toBeGreaterThan(0);
    expect(dep).toBeLessThan(base);
  });
  // 선납: 견적조건 M48(선납금 CC21 원금 차감) + 렌트_입력시트 BR28/BR29(선납렌트료 회차균등 차감) 수식 재현
  it("선납 10% 월렌트료는 기본 대비 최소 선납렌트료(선납금/기간)만큼 낮다", () => {
    const base = computeMonthlyRent(SANTA, 35000000, 36, 20000, CONSTS)!;
    const pre = computeMonthlyRent(SANTA, 35000000, 36, 20000, CONSTS, { prepayRate: 0.1 })!;
    const prepayMonthly = Math.floor(3500000 / 36 / 10) * 10; // ROUNDDOWN(CC21/n, -1)
    expect(pre).toBeGreaterThan(0);
    expect(pre).toBeLessThanOrEqual(base - prepayMonthly);
  });
});
