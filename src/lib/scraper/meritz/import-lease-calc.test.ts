import { describe, it, expect } from "vitest";
import {
  computeImportLeaseAcqCost, computeMonthlyImportLease, importLeaseAcqTax, pickImportLeaseResidual,
} from "./import-lease-calc";
import type { MeritzImportLeaseConsts, MeritzImportLeaseTrim } from "./import-lease-parse";

// 검증 기준: 배포 엑셀(MeritzCapital 수입신차견적 2607 V2)의 선택차 캐시값 원단위 대조.
// Audi A6 40 TFSI S-Line, 차량가 80,000,000 / 배포 입력 상태(보증금 12%, 계약잔가 36/48/60=0.49/0.41/0.35,
// CM 2%, 추가수수료 1%, 탁송·부대 각 100,000, 수원 공채 0):
// 취득세 5,090,900 / 취득원가('내부'H8) 85,290,900 / 원금('내부'J54) -78,259,610
// → 리스료('내부'H30) 36/48/60 = 1,644,700 / 1,424,700 / 1,264,400.
const A6: MeritzImportLeaseTrim = {
  manufacturer: "Audi", name: "A6 40 TFSI S-Line", msrp: 80000000, disp: 1984, taxClass: "승용",
  grades: { west: "B", aj: "AA", aps: "C", vgs: "", self: "" },
  highResidualBlocked: false, hiResExtra15k: 0, hiResExtra10k: 0,
};

const CONSTS: MeritzImportLeaseConsts = {
  grids: {
    west: { B: { 12: 0.66, 24: 0.58, 36: 0.5, 48: 0.42, 60: 0.36 } },
    aj: { AA: { 12: 0.79, 24: 0.71, 36: 0.62, 48: 0.54, 60: 0.48 } },
    aps: { C: { 12: 0.77, 24: 0.6900000000000001, 36: 0.6, 48: 0.52, 60: 0.46 } },
    vgs: {}, self: {},
  },
  acqTaxTable: { 승용: { rate: 0.07, evReduction: 0 }, 전기: { rate: 0.07, evReduction: 1400000 } },
  irrByBrand: { Audi: 0.0635, Bentley: 0 },
  lowDepositSurcharge: 0.0015,
  cmFeeRate: 0.02, extraFeeRate: 0.01, deliveryFee: 100000, incidentalFee: 100000,
};

const PRICE = 80000000;

describe("meritz import lease calculator", () => {
  it("취득세 재현: 승용 5,090,900 / 전기 감면 3,690,900", () => {
    expect(importLeaseAcqTax(A6, PRICE, CONSTS)).toBe(5090900);
    expect(importLeaseAcqTax({ ...A6, taxClass: "전기" }, PRICE, CONSTS)).toBe(3690900);
  });
  it("취득원가('내부'H8) 재현 = 85,290,900", () => {
    expect(computeImportLeaseAcqCost(A6, PRICE, CONSTS)).toBe(85290900);
  });
  it("배포 캐시 상태(보증금12%·계약잔가 지정) 리스료 원단위 재현: 36/48/60 = 1,644,700/1,424,700/1,264,400", () => {
    const opts = (rv: number) => ({ depositRate: 0.12, contractResidualRate: rv });
    expect(computeMonthlyImportLease(A6, PRICE, 36, 20000, CONSTS, opts(0.49))).toBe(1644700);
    expect(computeMonthlyImportLease(A6, PRICE, 48, 20000, CONSTS, opts(0.41))).toBe(1424700);
    expect(computeMonthlyImportLease(A6, PRICE, 60, 20000, CONSTS, opts(0.35))).toBe(1264400);
  });
  it("표준 잔가 선택: AJ(오토준) 최고잔가 0.70(0.62+고잔가8%)", () => {
    const pick = pickImportLeaseResidual(A6, CONSTS, PRICE, 36, 20000)!;
    expect(pick.company).toBe("aj");
    expect(pick.rate).toBeCloseTo(0.7, 10);
    expect(pick.normal).toBeCloseTo(0.62, 10);
  });
  it("표준(보증금0) 리스료 산출 — 저보증금 금리 가산 반영, 양수", () => {
    const base = computeMonthlyImportLease(A6, PRICE, 36, 20000, CONSTS)!;
    expect(base).toBeGreaterThan(0);
  });
  it("3만km는 고잔가 미적용·잔가 -4% → 2만km보다 리스료가 높다", () => {
    const k20 = computeMonthlyImportLease(A6, PRICE, 36, 20000, CONSTS)!;
    const k30 = computeMonthlyImportLease(A6, PRICE, 36, 30000, CONSTS)!;
    expect(k30).toBeGreaterThan(k20);
  });
  it("보증금 10% 리스료는 기본보다 낮다", () => {
    const base = computeMonthlyImportLease(A6, PRICE, 36, 10000, CONSTS)!;
    const dep = computeMonthlyImportLease(A6, PRICE, 36, 10000, CONSTS, { depositRate: 0.1 })!;
    expect(dep).toBeGreaterThan(0);
    expect(dep).toBeLessThan(base);
  });
  it("선수금 10% 리스료는 기본보다 낮다", () => {
    const base = computeMonthlyImportLease(A6, PRICE, 36, 10000, CONSTS)!;
    const pre = computeMonthlyImportLease(A6, PRICE, 36, 10000, CONSTS, { prepayRate: 0.1 })!;
    expect(pre).toBeGreaterThan(0);
    expect(pre).toBeLessThan(base);
  });
  it("취급불가 케이스는 null: IRR 미등재 브랜드·잔가군 없음·지원 외 기간", () => {
    expect(computeMonthlyImportLease({ ...A6, manufacturer: "Bentley" }, PRICE, 36, 20000, CONSTS)).toBeNull();
    expect(computeMonthlyImportLease({ ...A6, grades: { west: "", aj: "", aps: "", vgs: "", self: "" } }, PRICE, 36, 20000, CONSTS)).toBeNull();
    expect(computeMonthlyImportLease(A6, PRICE, 72, 20000, CONSTS)).toBeNull();
  });
});
