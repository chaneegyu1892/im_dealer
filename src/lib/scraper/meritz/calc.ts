// 메리츠캐피탈 렌터카(장기렌트) 월납입금 계산기 — 배포 엑셀 견적기 수식을 코드로 재현.
// 검증: 26MY 싼타페 HEV 35,000,000 → 36/보증0=478,060 · 48/보증0=455,400 · 60/보증40%=376,750 (엑셀 원단위 일치).
// 상세 수식·셀추적: scripts/scraper-worker/MERITZ-NOTES.md ②.
// 가격(P)은 엑셀에 없어 외부(우리 DB)에서 주입. 표준조건은 STANDARD 로 고정.

/** 엑셀 반올림 함수(자릿수 d: 음수=10^|d| 단위). */
const f = (d: number) => Math.pow(10, d);
export const roundUp = (v: number, d: number) => Math.ceil(v * f(d) - 1e-9) / f(d);
export const roundDown = (v: number, d: number) => Math.floor(v * f(d) + 1e-9) / f(d);
export const roundE = (v: number, d: number) => Math.round(v * f(d)) / f(d);
const trunc1 = (v: number) => Math.trunc(v / 10) * 10; // TRUNC(v, -1)

/** Excel PMT(rate, nper, pv, fv, type=0). */
export function pmt(rate: number, nper: number, pv: number, fv = 0, type = 0): number {
  if (rate === 0) return -(pv + fv) / nper;
  const p = Math.pow(1 + rate, nper);
  return -(rate * (fv + pv * p)) / ((p - 1) * (1 + rate * type));
}

/** 트림 1건의 계산 입력 (차량정보/탁송 시트에서 파싱). */
export interface MeritzTrim {
  manufacturer: string;
  name: string;         // 차종명(E)
  gaesoseK: number;     // 개소세계수(F)
  insGrade: string;     // 보험등급(H) — 승합/경차/다인승/면제 면 공채 0
  strategy: string;     // 전략구분(I)
  fuel: string;         // 유종(J): 가솔린/EV/하이브리드
  disp: number;         // 배기량(L)
  mfrDiscount: number;  // 제조사할인율(M)
  rvGroup: string;      // 잔가군(N)
  residual: Record<string, number>; // 잔가율 `${months}_${distKm}` → 0~1
  irrAdj: Record<string, number>;   // IRR조정 `${months}_${distKm}` → 이율 가감
  deliveryFeeSeoul: number;         // 탁송(서울/경기/인천, 탁송 시트)
  evSubsidy: number;                // EV보조금(EV만)
}

/** 견적기 전역 상수(엑셀 견적조건에서 파싱 — 월별 갱신 대비). */
export interface MeritzConstants {
  strategyBaseRate: Record<string, number>; // 전략 → 기본이율(견적조건 G36:H50)
}

/** 확정 표준조건(2026-07-14): 정비 Basic·만기선택형·만26세·면책30만·대물1억·M+Members미가입·선납0·보증0·월동장비미지급. */
const STD = {
  insByAge: 620000,      // 운전연령 만26세이상 연보험료(견적조건 D91) → /12
  jeukchaek: 46000,      // 면책 30만원(견적조건 D127)
  maint: 6000,           // 정비 Basic 월(견적조건 N19=4)
  mMembers: 0,           // M+Members 미가입
  inspection: 26000,     // 검사비(견적조건 H23)
  deliveryFixed: 126500, // 탁송 고정분(견적조건 D67)
  acqTaxRate: 0.04,      // 취득세율
  evAcqReduce: 1400000,  // EV 취득세 감면(잔가군≠X)
  bondBuyRate: 0.0287,   // 공채 매입 실율(H58 = 공급가액×2.87%×130%)
  bondFactor: 1.3,
  bondSurcharge: 0.04,   // 공채 부대(H32)
  bondReduceHEV: 910000, // 공채 감면 HEV(H64)
  bondReduceEV: 3900000, // 공채 감면 EV
  const500: 500, const700: 700,
};

const isHevEv = (fuel: string) => fuel === "하이브리드" || fuel === "EV";
const key = (months: number, distKm: number) => `${months}_${distKm}`;

/** 취득원가 PV(견적조건 H21) — 개소세 machinery + 취득세 + 탁송 + 공채 + 검사 − EV보조금. */
export function computePV(t: MeritzTrim, price: number): number {
  const H14 = roundE(price / t.gaesoseK, 0);
  const H15 = roundE(H14 * 0.1, 0);
  const H13 = H14 + H15;
  const H8 = roundDown((price / t.gaesoseK) * t.mfrDiscount * 1.1, -3);
  const H18 = roundE((H13 - H8) / 1.1, 0); // 공급가액(VAT제외)
  // 취득세
  const H33 = t.fuel === "EV" && t.rvGroup !== "X" ? STD.evAcqReduce : 0;
  const acqTax = trunc1(isHevEv(t.fuel) ? Math.max(0, H18 * STD.acqTaxRate - H33) : H18 * STD.acqTaxRate);
  // 공채(G52=2 가정): H29 = 승합/경차/다인승/면제 → 0, else H58 − 감면. H31 = HEV/EV 면 +100.
  const H28 = roundDown(H18, -3);
  const H58 = H28 * STD.bondBuyRate * STD.bondFactor;
  const bondReduce = t.fuel === "EV" ? STD.bondReduceEV : t.fuel === "하이브리드" ? STD.bondReduceHEV : 0;
  const noBond = ["승합", "경차", "다인승", "면제"].includes(t.insGrade);
  const H29 = noBond ? 0 : H58 - bondReduce;
  const H31 = isHevEv(t.fuel) ? Math.max(0, H29 + 100) : H29;
  const bond = H31 + roundDown(H31 * STD.bondSurcharge, -1);
  // 탁송(서울) + 고정분
  const delivery = t.deliveryFeeSeoul + STD.deliveryFixed;
  return H18 + delivery / 1.1 + bond + acqTax + STD.inspection - (t.fuel === "EV" ? t.evSubsidy : 0);
}

/** 보험+정비 월분(견적조건 EG10) — [Select 프로모션] 고정번들 vs 계산. */
function insuranceMaint(t: MeritzTrim, months: number): number {
  if (t.name.startsWith("[Select 프로모션] 레이")) {
    return 27800 + (months === 48 ? 1000 : 0) + (months === 60 ? 1500 : 0);
  }
  let base: number;
  if (t.name.startsWith("[Select")) base = 38200 + (months === 60 ? 3000 : 0);
  else base = STD.jeukchaek + STD.maint; // 비프로모션: 면책 + 정비Basic
  if (t.rvGroup === "정비프로모션" && months === 60) base += 3000;
  return base;
}

/** 월 고정수수료(기간별) = 자동차세 + 보험연령 + 보험/정비 + 500 + 700 + M+Members/1.1. */
export function feeMonthly(t: MeritzTrim, months: number): number {
  const carTax = roundUp(
    t.fuel === "EV" ? 2000 : t.disp <= 1600 ? (t.disp * 18) / 12 : t.disp <= 2500 ? (t.disp * 19) / 12 : (t.disp * 24) / 12,
    -2
  );
  const insAge = roundUp(STD.insByAge / 12, -2);
  return carTax + insAge + insuranceMaint(t, months) + STD.const500 + STD.const700 + STD.mMembers / 1.1;
}

/** 재무원가율(렌트_입력 BR19): 전략AA=2%, 그 외=1%(개인). */
function finRate(strategy: string): number {
  return strategy === "전략AA" ? 0.02 : 0.01;
}

/**
 * 트림 1건의 월렌트료(VAT포함) — 표준조건, 지정 (기간×거리).
 * 보증율/선납율 옵션(카탈로그 기본 0). 견적불가(잔가율 없음)면 null.
 */
export function computeMonthlyRent(
  t: MeritzTrim, price: number, months: number, distKm: number, consts: MeritzConstants,
  opts: { depositRate?: number; prepayRate?: number } = {}
): number | null {
  const r = t.residual[key(months, distKm)];
  if (r === undefined || r <= 0) return null;
  const depositRate = opts.depositRate ?? 0;

  const baseRate = (consts.strategyBaseRate[t.strategy] ?? consts.strategyBaseRate["기본"] ?? 0.065)
    + (t.irrAdj[key(months, distKm)] ?? 0);
  const PV = computePV(t, price);
  const FVpv = roundE(roundUp(price * r, -3) / 1.1, 0);
  const deposit = roundUp(price * depositRate, -3);
  const financed = Math.trunc((price * finRate(t.strategy)) / 1000) * 1000;
  // EG7 ≈ {기간}48 = ROUNDUP(PMT(baseRate/12, n, −(PV − 보증금 + 재무원가), FVpv − 보증금), −1)
  const eg7 = roundUp(pmt(baseRate / 12, months, -(PV - deposit + financed), FVpv - deposit, 0), -1);
  const supply = roundUp(eg7 + feeMonthly(t, months), -2);
  return supply + roundDown(supply * 0.1, -1); // 공급가 + 부가세
}
