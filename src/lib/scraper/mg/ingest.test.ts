import { describe, it, expect, vi } from "vitest";
import { ingestMgRent } from "./ingest";
import { computeMonthlyRent, residualRate, type MgTrim } from "./calc";

// MG 렌트 견적기 주행거리 드롭다운(일반상품)에는 10,000km 가 없음(17,000부터) —
// 회의(7/24) 14번 결정: 1만km 셀은 17,000km 조건으로 산출. 키는 시스템 공통 "*_10000" 유지.
const TRIM: MgTrim = {
  manufacturer: "현대자동차", name: "더뉴_그랜저_2.5_(가솔린)", disp: 2497, fuel: "가솔린",
  teuksoK: 1.1572, vehClass: "승용",
  residualBase: { 36: 0.5, 48: 0.45, 60: 0.4 },
  rvSpecial: 0.01, rvEvent: 0, rvAdd48: 0, rvAdd60: 0,
  rate: { 36: 0.06, 48: 0.06, 60: 0.06 },
  insuranceAnnual: 1200000, deliveryFee: 300000, maintMonthly: 30000,
};

vi.mock("./parse", () => ({ parseMgRentWorkbook: () => ({ trims: [TRIM] }) }));

const PRICE = 30000000;

describe("mg rent ingest — 1만km 셀 17,000km 대체", () => {
  const mdelCd = "현대_더뉴 그랜저 2.5 (가솔린)".toLowerCase().replace(/[\s()[\]/,._-]/g, "");
  const result = ingestMgRent(Buffer.alloc(0), [], new Map([[mdelCd, { trimId: "t1", price: PRICE }]]));
  const entry = result.entries[0];

  it("36_10000 잔가율은 17,000km 조건 값으로 저장된다 (10,000km 거리조정 +2% 미적용)", () => {
    expect(entry.residualRates?.["36_10000"]).toBe(residualRate(TRIM, 36, 17000));
    expect(entry.residualRates?.["36_10000"]).not.toBe(residualRate(TRIM, 36, 10000));
  });
  it("36_10000 월대여료는 17,000km 조건으로 산출된다", () => {
    expect(entry.baseRates["36_10000"]).toBe(computeMonthlyRent(TRIM, PRICE, 36, 17000));
  });
  it("보증금/선납 샘플도 17,000km 조건으로 산출된다", () => {
    expect(entry.depositRate36_10000).toBe(computeMonthlyRent(TRIM, PRICE, 36, 17000, { depositRate: 0.1 }));
    expect(entry.prepayRate36_10000).toBe(computeMonthlyRent(TRIM, PRICE, 36, 17000, { prepayRate: 0.1 }));
  });
  it("2만/3만km 셀은 기존과 동일하게 해당 거리 조건으로 산출된다", () => {
    expect(entry.baseRates["36_20000"]).toBe(computeMonthlyRent(TRIM, PRICE, 36, 20000));
    expect(entry.baseRates["36_30000"]).toBe(computeMonthlyRent(TRIM, PRICE, 36, 30000));
  });
});
