// MG캐피탈 렌터카(장기렌트) 월 대여료 계산기 — 배포 엑셀 견적기 수식을 코드로 재현.
// 검증: 더뉴_그랜저_2.5 30,000,000 / 36개월·20,000km → 493,570 (엑셀 CW25 원단위 일치).
// 구조는 메리츠와 유사(PMT + PV개소세 + 잔가율 + 이율 + 수수료 + VAT). 상세 MG-NOTES.md.
// 가격(P)은 엑셀에 없어 외부(우리 DB)에서 주입. 표준조건 고정.

const f = (d: number) => Math.pow(10, d);
export const roundUp = (v: number, d: number) => Math.ceil(v * f(d) - 1e-9) / f(d);
export const roundDown = (v: number, d: number) => Math.floor(v * f(d) + 1e-9) / f(d);
export const roundE = (v: number, d: number) => Math.round(v * f(d)) / f(d);

export function pmt(rate: number, nper: number, pv: number, fv = 0, type = 0): number {
  if (rate === 0) return -(pv + fv) / nper;
  const p = Math.pow(1 + rate, nper);
  return -(rate * (fv + pv * p)) / ((p - 1) * (1 + rate * type));
}

/** 트림 1건의 계산 입력 (차량_List + 각 테이블에서 파싱). */
export interface MgTrim {
  manufacturer: string;
  name: string;          // 차종(C)
  disp: number;          // 배기량(D)
  fuel: string;          // 유종(E): 가솔린/HEV/디젤/LPI/EV
  teuksoK: number;       // 특소세계수(F), 1.1=감면·1.1572/1.15863=과세
  vehClass: string;      // 차종구분(G/H): 승용/다인승/승합/경차
  residualBase: Record<number, number>; // 잔가table[기간] (36/48/60), CD21키(잔가군) 기준
  // 잔가보장사_잔가 기간/거리별 가감 (H=차종특별·G=event·K=48추가·L=60추가)
  rvSpecial: number;   // H(col6): 기간>24 적용
  rvEvent: number;     // G(col5): 기간≠60 적용
  rvAdd48: number;     // K(col9): 48개월 & 20000km
  rvAdd60: number;     // L(col10): 60개월 & 20000km
  rate: Record<number, number>;          // 운영기준 이율[기간]
  insuranceAnnual: number;               // 보험 연납(보험table[대물][class])
  deliveryFee: number;                   // 탁송(료+공채+상수, DT5)
  maintMonthly: number;                  // 정비 월(Basic 등, DA93)
}

/** 거리조정(견적시트 CV101:CW110) — 상수. */
const DIST_ADJ: Record<number, number> = {
  10000: 0.02, 15000: 0.06, 17000: 0, 20000: 0.01, 25000: 0.04,
  30000: -0.02, 35000: 0, 40000: -0.08, 45000: -0.04, 50000: -0.12,
};

/** 확정 표준조건(카탈로그): 운전 만26세·법인보험 미가입·대물1억·대인무제한·정비 Basic·선납0·보증0·잔가보장 포함. */
const STD = {
  bondFactor: 1.3,        // 취득세류 130%
  acqBase: 0.04,          // 취득세율 4%
  acqSurcharge: 0.04,     // 취득세류 부대 4%
  hevBondReduce: 910000,  // HEV 취득세류 감면(DN25)
  carTaxConstAdd: 0,
  const19: 150, const20: 600,
  insMonthlyBonus: 3000,  // 승용 보험 +3000(CW78)
  insMonthlyBase: -7000,  // CW78 말미 -7000
};

const isHev = (fuel: string) => fuel === "HEV";

/** 공급가액(DG10) = ROUND(차량가/특소세계수, 0). */
function supplyExVat(price: number, teuksoK: number): number {
  const DG16 = roundE(price / teuksoK, 0);
  return roundDown((DG16 * 1.1) / 1.1, 0); // 옵션0 → ≈DG16
}

/** 취득원가 PV(BK75) = 공급가액 + 취득세류 + 취득세 + 탁송. */
function computePV(t: MgTrim, price: number): number {
  const DG10 = supplyExVat(price, t.teuksoK);
  // 취득세류(DG24): 특소세>1.1 → 공급가액×5.2% − HEV감면 + 부대(4%). 1.1(감면) → 0.
  let acqExtra = 0;
  if (t.teuksoK > 1.1001) {
    const DM25 = DG10 * STD.acqBase * STD.bondFactor;       // ×4%×130%
    const DN25 = isHev(t.fuel) ? STD.hevBondReduce : 0;
    const DO25 = roundDown((DM25 - DN25) * STD.acqSurcharge, -1);
    acqExtra = DM25 - DN25 + DO25;
  }
  const acqTax = roundDown(isHev(t.fuel) ? Math.max(0, DG10 * STD.acqBase) : DG10 * STD.acqBase, -1); // 취득세(DG25)
  return DG10 + acqExtra + t.deliveryFee + acqTax;
}

/** 자동차세 월(CW16) = ROUNDUP(배기량 기반, -2). */
function carTax(disp: number, fuel: string): number {
  if (fuel === "EV") return 13000; // EV 정액(추정, 파싱 확정 필요)
  const yearly = disp <= 1600 ? disp * 18 : disp <= 2500 ? disp * 19 : disp * 24;
  return roundUp(yearly / 12, -2);
}

/** 보험 월(CW78) = ROUNDUP(연납/12,-2) + class보너스 − 7000. */
function insuranceMonthly(t: MgTrim): number {
  const base = roundUp(t.insuranceAnnual / 12, -2);
  const bonus = t.vehClass === "경차" ? 0 : t.vehClass.includes("다인승") || t.vehClass === "승합" ? 5500 : STD.insMonthlyBonus;
  return base + bonus + STD.insMonthlyBase;
}

/** 잔가율 = base[기간] + 거리조정 + H(기간>24) + G(≠60) + K(48&2만) + L(60&2만). */
export function residualRate(t: MgTrim, months: number, distKm: number): number {
  const base = t.residualBase[months] ?? 0;
  if (base <= 0) return 0;
  let rv = base + (DIST_ADJ[distKm] ?? 0);
  if (months > 24) rv += t.rvSpecial;
  if (months !== 60) rv += t.rvEvent;
  if (months === 48 && distKm === 20000) rv += t.rvAdd48;
  if (months === 60 && distKm === 20000) rv += t.rvAdd60;
  return rv;
}

/** 월 대여료(VAT포함) — 표준조건, 지정 (기간×거리). 잔가율 없으면 null. */
export function computeMonthlyRent(t: MgTrim, price: number, months: number, distKm: number): number | null {
  const rv = residualRate(t, months, distKm);
  if (rv <= 0) return null;
  const rate = t.rate[months];
  if (!rate) return null;

  const PV = computePV(t, price);
  const residualValue = roundDown(price * rv, -1);  // 만기인수(BM88)
  const FV = residualValue / 1.1;                    // 만기인수/1.1
  // 공급가본체(CW15) = ROUNDUP(ROUNDUP(PMT(이율/12, n, -PV, FV),-1), -2). 선납0/보증0 → 정규화 항등.
  const cw30 = roundUp(pmt(rate / 12, months, -PV, FV, 0), -1);
  const cw15 = roundUp(cw30, -2);
  // 월공급가(CW22) = ROUNDUP(본체 + 자동차세 + 보험 + 정비 + 150 + 600, -2)
  const cw22 = roundUp(cw15 + carTax(t.disp, t.fuel) + insuranceMonthly(t) + t.maintMonthly + STD.const19 + STD.const20, -2);
  return cw22 + roundDown(cw22 * 0.1, -1); // 공급가 + 부가세 = 월 대여료
}
