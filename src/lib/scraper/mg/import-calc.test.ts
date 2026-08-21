import { describe, it, expect } from "vitest";
import { computeImportAcqCost, computeMonthlyImportLease, importAcqTax, pickResidual } from "./import-calc";
import type { MgImportConsts, MgImportTrim } from "./import-parse";

// 검증 기준: 배포 엑셀(MG 수입견적 26.07월 외부용 2606 vol1)의 선택차 캐시값 원단위 대조.
// BMW 740i xDrive DPE, 계산서가 160,800,000 입력 상태 (60개월/2만km, 잔가군 SNK=L·APS=H, 고잔가 Y):
// 취득세 CI21=10,232,720 / 취득원가 CI23=171,032,720 / 잔가보장수수료 CI55=2,122,560(SNK 1.32%)
// 최대잔가율 CR62=0.51…(L 0.43+고잔가8%) / 잔가 CI42=82,008,000 / 표시금리 CQ28=5.368% / 월납입금 AG14=2,062,000.
// 잔가율 리터럴은 엑셀 저장 부동소수 원값 — ROUNDDOWN 경계 일치에 필요하므로 반올림하지 말 것.
const BMW740: MgImportTrim = {
  manufacturer: "BMW", name: "740i xDrive DPE", disp: 2998, vehClass: "승용일반",
  msrp: 174400000, highResidual: true, snkGrade: "L", apsGrade: "H",
  snkPromo: 0, apsPromo: 0, chabot: {},
};

const CONSTS: MgImportConsts = {
  snkMap: {
    L: { 12: 0.7399999999999999, 24: 0.6599999999999999, 36: 0.57, 48: 0.4899999999999999, 60: 0.42999999999999994 },
  },
  apsMap: {
    H: { 12: 0.72, 24: 0.64, 36: 0.5499999999999999, 48: 0.47000000000000003, 60: 0.41000000000000003 },
  },
  irrByBrand: { bmw: 0.05 },
  irrFinanceByBrand: { bmw: 0.1 },
  irrInstallmentByBrand: { bmw: 0.1 },
  stampDuty: 10000,
  gapFeeRate: { snk: 0.0132, aps: 0.011 },
};

const PRICE = 160800000;

describe("mg import lease calculator", () => {
  it("취득세(CI21) 재현 = 10,232,720", () => {
    expect(importAcqTax(BMW740, PRICE)).toBe(10232720);
  });
  it("취득원가(CI23) 재현 = 171,032,720", () => {
    expect(computeImportAcqCost(BMW740, PRICE)).toBe(171032720);
  });
  it("잔가 선택: SNK L 0.43 + 고잔가 8% → 최대잔가율 0.51(CR62), 잔가보장사 SNK", () => {
    const pick = pickResidual(BMW740, CONSTS, 60, 20000)!;
    expect(pick.company).toBe("snk");
    expect(Math.floor(PRICE * pick.rate / 1000) * 1000).toBe(82008000); // CI42
  });
  it("60개월/2만km 월납입금 = 2,062,000", () => {
    expect(computeMonthlyImportLease(BMW740, PRICE, 60, 20000, CONSTS)).toBe(2062000);
  });
  it("주행거리 가감: 1만km(+0.5%)는 2만km보다, 2만km는 3만km(-5%)보다 월납입금이 낮다", () => {
    const k10 = computeMonthlyImportLease(BMW740, PRICE, 60, 10000, CONSTS)!;
    const k20 = computeMonthlyImportLease(BMW740, PRICE, 60, 20000, CONSTS)!;
    const k30 = computeMonthlyImportLease(BMW740, PRICE, 60, 30000, CONSTS)!;
    expect(k10).toBeLessThan(k20);
    expect(k20).toBeLessThan(k30);
  });
  it("고잔가 미대상이면 잔가 +8%·잔가보장수수료 없이 산출 — 월납입금은 더 높다", () => {
    const noHigh = computeMonthlyImportLease({ ...BMW740, highResidual: false }, PRICE, 60, 20000, CONSTS)!;
    expect(noHigh).toBeGreaterThan(2062000);
  });
  it("잔가군·차봇 잔가가 모두 없으면 null (잔가군 미등재 차량 견적 차단)", () => {
    const noGrade = { ...BMW740, snkGrade: "", apsGrade: "" };
    expect(computeMonthlyImportLease(noGrade, PRICE, 60, 20000, CONSTS)).toBeNull();
  });
  it("지원하지 않는 기간(72개월)은 null", () => {
    expect(computeMonthlyImportLease(BMW740, PRICE, 72, 20000, CONSTS)).toBeNull();
  });
  it("보증금 10% 월납입금은 기본보다 낮다", () => {
    const base = computeMonthlyImportLease(BMW740, PRICE, 36, 10000, CONSTS)!;
    const dep = computeMonthlyImportLease(BMW740, PRICE, 36, 10000, CONSTS, { depositRate: 0.1 })!;
    expect(dep).toBeGreaterThan(0);
    expect(dep).toBeLessThan(base);
  });
  it("선납금 10% 월납입금은 기본 대비 최소 선납 회차균등액 근접분만큼 낮다", () => {
    const base = computeMonthlyImportLease(BMW740, PRICE, 36, 10000, CONSTS)!;
    const pre = computeMonthlyImportLease(BMW740, PRICE, 36, 10000, CONSTS, { prepayRate: 0.1 })!;
    expect(pre).toBeGreaterThan(0);
    expect(pre).toBeLessThan(base);
  });
});
