import { describe, it, expect } from "vitest";
import {
  computeMonthlyMgFinanceLease, computeMonthlyMgInstallment,
  financeAcqTax, installmentMortgageFee, installmentStampDuty,
} from "./import-finance-calc";
import type { MgImportConsts, MgImportTrim } from "./import-parse";

// 검증 기준: 배포 엑셀(MG 수입견적 2606 vol1) 금융리스/할부오토론 시트의 살아있는 중간값 캐시 원단위 대조.
// 최종 월납입금 캐시는 전부 스테일(42)이라 대조 불가 — PMT/RATE 기계는 운용리스 740i 앵커로 검증된 것을 공유.
// 금융리스 저장 상태(Benz A250, 계산서가 50,000,000): 취득세 CI21=3,181,810 /
//   총구매비용 CI22=53,381,810(딜러 잔존 탁송·등록 10만+10만 포함) / 설정금액 CI81=53,390,000 / 설정료 CI82=320,340
// 할부 저장 상태(EV disp=1, 계산서가 70,400,000): 취득세 3,730,000(-75만 차감) / 할부원금 CI23=74,130,000 /
//   인지세 CI80=35,000 / 설정금액 CI81=74,130,000 / 설정료 CI82=444,780
const BENZ_A250: MgImportTrim = {
  manufacturer: "BENZ", name: "A250", disp: 1991, vehClass: "승용일반",
  msrp: 52000000, highResidual: false, snkGrade: "", apsGrade: "",
  snkPromo: 0, apsPromo: 0, chabot: {},
};
const EV: MgImportTrim = { ...BENZ_A250, name: "EV", disp: 1 };

const CONSTS: MgImportConsts = {
  snkMap: {}, apsMap: {},
  irrByBrand: {},
  irrFinanceByBrand: { benz: 0.1 },
  irrInstallmentByBrand: { benz: 0.1 },
  stampDuty: 10000,
  gapFeeRate: { snk: 0.0132, aps: 0.011 },
};

describe("mg import finance/installment calculator", () => {
  it("금융리스 취득세(CI21) = 3,181,810 — 총구매비용 캐시 53,381,810 재현(탁송·등록 20만 포함 상태)", () => {
    expect(financeAcqTax(BENZ_A250, 50000000)).toBe(3181810);
    expect(50000000 + 3181810 + 100000 + 100000).toBe(53381810); // CI22 캐시
  });
  it("경차특례 차감형(CI15): EV(disp=1) 취득세 = 4,480,000 - 750,000 = 3,730,000 (운용리스 면제형과 다름)", () => {
    expect(financeAcqTax(EV, 70400000)).toBe(3730000);
  });
  it("75만 미만이면 취득세 0", () => {
    expect(financeAcqTax(EV, 10000000)).toBe(0); // 10M/1.1*7% = 636,360 < 750,000
  });
  it("할부 인지세(CI80) 구간: ~5천만 0 / ~1억 35,000 / 초과 75,000 — 할부원금 74,130,000 → 35,000", () => {
    expect(installmentStampDuty(50000000)).toBe(0);
    expect(installmentStampDuty(50000001)).toBe(35000);
    expect(installmentStampDuty(74130000)).toBe(35000);
    expect(installmentStampDuty(100000001)).toBe(75000);
  });
  it("설정료(CI81→CI82): 원금 53,381,810 → 설정금액 53,390,000 → 320,340 (금융리스 시트 캐시)", () => {
    expect(installmentMortgageFee(53381810)).toBe(320340);
  });
  it("설정료: 원금 74,130,000 → 설정금액 74,130,000 → 444,780 (할부 시트 캐시)", () => {
    expect(installmentMortgageFee(74130000)).toBe(444780);
  });
  it("설정금액 750만 미만은 0.4%+15,000 요율", () => {
    expect(installmentMortgageFee(4990001)).toBe(35000); // ROUNDUP(-4)=5,000,000 → 20,000+15,000
  });

  it("금융리스 월납입금: 100원 단위 올림, 수수료 반영으로 원금 IRR 기본 PMT 보다 높다", () => {
    const monthly = computeMonthlyMgFinanceLease(BENZ_A250, 50000000, 36, CONSTS)!;
    expect(monthly % 100).toBe(0);
    const principal = 50000000 + 3181810;
    const basePmt = (principal * (0.1 / 12)) / (1 - Math.pow(1 + 0.1 / 12, -36));
    expect(monthly).toBeGreaterThan(basePmt); // 인지세가 표시금리로 흡수돼 IRR보다 높아짐
    expect(monthly).toBeLessThan(basePmt * 1.01);
  });
  it("할부 월납입금은 같은 조건 금융리스보다 높다 (설정료+인지세 > 인지세 1만)", () => {
    const fin = computeMonthlyMgFinanceLease(BENZ_A250, 50000000, 36, CONSTS)!;
    const inst = computeMonthlyMgInstallment(BENZ_A250, 50000000, 36, CONSTS)!;
    expect(inst).toBeGreaterThan(fin);
  });
  it("선수금 10%(차량가비율, ROUNDDOWN -3)면 월납입금이 낮아진다", () => {
    const base = computeMonthlyMgFinanceLease(BENZ_A250, 50000000, 36, CONSTS)!;
    const dep = computeMonthlyMgFinanceLease(BENZ_A250, 50000000, 36, CONSTS, { depositRate: 0.1 })!;
    expect(dep).toBeGreaterThan(0);
    expect(dep).toBeLessThan(base);
  });
  it("브랜드 IRR 없으면 취급불가 null", () => {
    const unknown = { ...BENZ_A250, manufacturer: "Bentley" };
    expect(computeMonthlyMgFinanceLease(unknown, 50000000, 36, CONSTS)).toBeNull();
    expect(computeMonthlyMgInstallment(unknown, 50000000, 36, CONSTS)).toBeNull();
  });
  it("지원하지 않는 기간(72개월)은 null", () => {
    expect(computeMonthlyMgFinanceLease(BENZ_A250, 50000000, 72, CONSTS)).toBeNull();
  });
  it("할부 표시금리 19.5% 초과는 '금리기준초과' null", () => {
    const high: MgImportConsts = { ...CONSTS, irrInstallmentByBrand: { benz: 0.25 } };
    expect(computeMonthlyMgInstallment(BENZ_A250, 50000000, 36, high)).toBeNull();
  });
});
