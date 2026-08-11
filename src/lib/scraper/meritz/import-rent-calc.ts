// 메리츠캐피탈 수입차 렌터카(장기렌트) 월렌트료 계산기 — 배포 엑셀(수입차 렌트 2607.v1) 수식을 코드로 재현.
// 검증: Model Y L AWD <지원금> 45,000,000 → 견적조건 H21=39,431,000 · 렌트_입력 EG14 캐시(36/48/60 = 774,400/700,500/654,400)
//   → 월렌트료(공급가+부가세) 851,840/770,550/719,840 원단위 일치.
// 표준조건(엑셀 기본 상태): 특판출고·제휴탁송사·서울/경기/인천·만기선택형·정비 면책100만·만26세이상·M+Members 미가입.
// 셀 추적: 견적조건 H4~H33(취득원가), M48/M49(PMT), 렌트_입력 EG7~EG14(월 구성), BR25~BR28(공급가·부가세·선납차감).

import { roundUp, roundDown, roundE, pmt } from "./calc";

const trunc1 = (v: number) => Math.trunc(v / 10) * 10; // TRUNC(v, -1)

/** 트림 1건의 계산 입력 (차량정보 브랜드 블록에서 파싱). */
export interface MeritzImportTrim {
  manufacturer: string;  // TESLA/폴스타/BYD
  name: string;          // 차종(블록 첫 컬럼)
  gaesoseK: number;      // 개소세계수
  strategy: string;      // 전략구분 (전략E 등) → 기준이율
  fuel: string;          // 유종: EV/가솔린/하이브리드…
  disp: number;          // 배기량
  discountAmt: number;   // 특판할인액(블록 선행 컬럼: BU/EL/HC)
  discountExtraRate: number; // 브랜드 추가 할인율(폴스타 +13%, 그 외 0)
  rvGroup: string;       // 잔가군 — "X"면 EV 취득세 감면 제외
  residual: Record<string, number>; // `${months}_${distKm}` → 잔가율
  irrAdj: Record<string, number>;   // IRR가산(기간×거리)
  maintMonthly: number;  // 정비 월액(면책100만·Basic, 정비 시트)
  deliveryFeeSeoul: number; // 1차 탁송료(서울/경기/인천)
  bigWash: boolean;      // 탁송 시트 세차 "O" → 세차비 +250,000
  evSubsidy: number;     // EV 보조금(특판출고 자동반영 테이블 합)
}

/** 견적기 전역 상수(견적조건 전략 이율표 G36:H49). */
export interface MeritzImportConstants {
  strategyBaseRate: Record<string, number>;
}

const STD = {
  insAnnual: 700000,     // 연보험료(만26세이상, 견적조건 D77)
  regFee: 26000,         // 등록제비용(번호판대 24,000 + 인지대 2,000)
  basicKitI: 126500,     // 기본용품Ⅰ(등록대행 33,000 + 세차 66,000 + 보조번호판 11,000 + 먼지털이개 16,500)
  bigWashAdd: 250000,    // 대형 세차 가산(탁송 시트 세차 "O")
  acqTaxRate: 0.04,      // 등취득세율(렌트 영업용)
  evAcqReduce: 1400000,  // EV 취등록세 감면(잔가군 X 제외)
  const500: 500, const700: 700,
  advRate40Surcharge: 0.005, // 담보율(보증+선납) 40% 이상 IRR 가산
  advRate50Surcharge: 0.005, // 50% 이상 추가 가산
};

const key = (months: number, distKm: number) => `${months}_${distKm}`;

/** 특판할인(H8) = ROUNDDOWN((할인액 + P×추가율) × 1.1 / 개소세계수, -3). */
function specialDiscount(t: MeritzImportTrim, price: number): number {
  return roundDown(((t.discountAmt + price * t.discountExtraRate) * 1.1) / t.gaesoseK, -3);
}

/** 취득원가(H21) = 출고공급가(H18) + 탁송·용품/1.1 + 등취득세 + 등록제비용 − EV보조금. */
export function computeImportAcqCost(t: MeritzImportTrim, price: number): number {
  const H14 = roundE(price / t.gaesoseK, 0);
  const H13 = H14 + roundE(H14 * 0.1, 0);
  const H17 = H13 - specialDiscount(t, price);
  const H18 = roundE(H17 / 1.1, 0);
  const isGreen = t.fuel === "EV" || t.fuel === "하이브리드";
  const H33 = t.fuel === "EV" && t.rvGroup !== "X" ? STD.evAcqReduce : 0;
  const H22 = trunc1(isGreen ? Math.max(0, H18 * STD.acqTaxRate - H33) : H18 * STD.acqTaxRate);
  const H24 = t.deliveryFeeSeoul + STD.basicKitI + (t.bigWash ? STD.bigWashAdd : 0);
  return H18 + H24 / 1.1 + H22 + STD.regFee - (t.fuel === "EV" ? t.evSubsidy : 0);
}

/** 월 고정수수료(EG8~EG12) = 자동차세 + 보험 + 정비(특가 트림 조정 포함) + 500 + 700. */
function feeMonthly(t: MeritzImportTrim): number {
  const carTax = roundUp(
    t.fuel === "EV" ? 2000 : t.disp <= 1600 ? (t.disp * 18) / 12 : t.disp <= 2500 ? (t.disp * 19) / 12 : (t.disp * 24) / 12,
    -2
  );
  const insM = roundUp(STD.insAnnual / 12, -2);
  let maint = t.maintMonthly;
  if (t.name === "(특가-1) Model Y Long Range 20인치휠") maint += 20600;
  if (t.name === "(특가-2) Model Y Long Range 20인치휠") maint += 27200;
  return carTax + insM + maint + STD.const500 + STD.const700;
}

/**
 * 트림 1건의 월렌트료(VAT포함) — 표준조건, 지정 (기간×거리). 잔가율 없으면 null.
 * 보증금/선납금(견적조건 M48 + 렌트_입력 BR27/BR28): 보증금은 원금·잔가 양쪽 차감,
 * 선납금은 원금 차감 후 M49(RATE 역산 항등)에서 회차균등액 재가산 → 최종에서 다시 차감.
 */
export function computeMonthlyImportRent(
  t: MeritzImportTrim, price: number, months: number, distKm: number, consts: MeritzImportConstants,
  opts: { depositRate?: number; prepayRate?: number } = {}
): number | null {
  const r = t.residual[key(months, distKm)];
  if (r === undefined || r <= 0) return null;
  const depositRate = opts.depositRate ?? 0;
  const prepayRate = opts.prepayRate ?? 0;

  const baseRate =
    (consts.strategyBaseRate[t.strategy] ?? consts.strategyBaseRate["일반"] ?? 0.06) +
    (t.irrAdj[key(months, distKm)] ?? 0) +
    (depositRate + prepayRate >= 0.4 ? STD.advRate40Surcharge : 0) +
    (depositRate + prepayRate >= 0.5 ? STD.advRate50Surcharge : 0);
  const H21 = computeImportAcqCost(t, price);
  const CC9 = roundUp(price * r, -3);            // 계약잔가
  const FVpv = roundE(CC9 / 1.1, 0);
  const deposit = depositRate > 0 ? roundUp(price * depositRate, -3) : 0; // CC8
  const prepay = prepayRate > 0 ? roundUp(price * prepayRate, -3) : 0;    // CC20
  const prepayMonthly = prepay > 0 ? roundDown(prepay / months, -1) : 0;  // |BR27|

  // M48 = ROUNDUP(PMT(이율/12, n, −(H21 − 보증금 − 선납금), FVpv − 보증금), -2)
  const m48 = roundUp(pmt(baseRate / 12, months, -(H21 - deposit - prepay), FVpv - deposit, 0), -2);
  const m49 = roundUp(m48 + prepayMonthly, -2);  // EG7 = M49 (BR31 RATE 역산 항등)
  const supply = roundE(m49 + feeMonthly(t), 0); // BR25 = ROUND(EG14)
  const vat = roundDown(supply * 0.1, 0);        // BR26
  const monthly = roundE(supply + vat, -1);      // BR22 월렌트료①
  return monthly - prepayMonthly;                // BR28 선납시 렌트료 ①−②
}
