import { describe, it, expect } from "vitest";
import { computeMonthlyLease, computeLeaseAcqCost, leaseVehiclePrice, type MeritzLeaseTrim } from "./lease-calc";

// 검증 기준: 배포 엑셀(국산 신차리스 2607.v3)의 선택차 캐시값 원단위 대조.
// 더 뉴 그랜저 2.5G, 기본가격 35,000,000, 특판할인 2.5%, 승용 가솔린 2497cc, 차세 649,220.
// 차량정보 row30 잔가 그리드 + 리스수식 W15=36,576,090, AA48=505,750, AA51=559,860(36/2만), AD55=522,230(48/2만), AG55=497,300(60/2만).
const GRANGER: MeritzLeaseTrim = {
  manufacturer: "현대", name: "더 뉴 그랜저 2.5G", kind: "승용",
  discountRate: 0.025, fuel: "가솔린", disp: 2497, carTaxAnnual: 649220,
  residual: {
    "36_10000": 0.73, "36_20000": 0.70, "36_30000": 0.66,
    "48_10000": 0.65, "48_20000": 0.62, "48_30000": 0.54,
    "60_10000": 0.59, "60_20000": 0.54, "60_30000": 0.36,
  },
  gaesoseExempt: false, deliveryFeeSeoul: 138000, evSubsidy: 0,
};

describe("meritz lease calculator", () => {
  it("차량가격(W2) = 35,000,000 − 특판할인 875,000 = 34,125,000", () => {
    expect(leaseVehiclePrice(GRANGER, 35000000)).toBe(34125000);
  });
  it("총취득원가(W15) 재현 = 36,576,090", () => {
    expect(computeLeaseAcqCost(GRANGER, 35000000)).toBe(36576090);
  });
  it("36개월/2만km 납부리스료 = 559,860", () => {
    expect(computeMonthlyLease(GRANGER, 35000000, 36, 20000)).toBe(559860);
  });
  it("48개월/2만km 납부리스료 = 522,230", () => {
    expect(computeMonthlyLease(GRANGER, 35000000, 48, 20000)).toBe(522230);
  });
  it("60개월/2만km 납부리스료 = 497,300", () => {
    expect(computeMonthlyLease(GRANGER, 35000000, 60, 20000)).toBe(497300);
  });
  it("잔가율 없는 셀은 null", () => {
    expect(computeMonthlyLease(GRANGER, 35000000, 36, 40000)).toBeNull();
  });
  it("보증금 10% 납부리스료는 기본보다 낮다", () => {
    const base = computeMonthlyLease(GRANGER, 35000000, 36, 20000)!;
    const dep = computeMonthlyLease(GRANGER, 35000000, 36, 20000, { depositRate: 0.1 })!;
    expect(dep).toBeGreaterThan(0);
    expect(dep).toBeLessThan(base);
  });
  it("선수금 10% 납부리스료는 기본 대비 최소 선수금/기간만큼 낮다", () => {
    const base = computeMonthlyLease(GRANGER, 35000000, 36, 20000)!;
    const pre = computeMonthlyLease(GRANGER, 35000000, 36, 20000, { prepayRate: 0.1 })!;
    const prepayMonthly = Math.floor(3413000 / 36 / 10) * 10; // ROUNDUP(34,125,000×10%,-3)/36 → ROUNDDOWN(-1)
    expect(pre).toBeGreaterThan(0);
    expect(pre).toBeLessThanOrEqual(base - prepayMonthly);
  });
});
