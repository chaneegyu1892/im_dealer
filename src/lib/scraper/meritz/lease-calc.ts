// 메리츠캐피탈 국산 신차 운용리스 매회리스료 계산기 — 배포 엑셀(신차리스 2607.v3) 수식을 코드로 재현.
// 검증: 더 뉴 그랜저 2.5G 35,000,000 → 36/2만=559,860 · 48/2만=522,230 · 60/2만=497,300 (엑셀 리스수식 AA51/AD55/AG55 캐시 원단위 일치).
// 표준조건(회의 15번·엑셀 기본 상태): 특판출고·차량등록명의 메리츠캐피탈·개인·일반잔가(잔가보장 미사용)·
// 차량가기준 보증금/잔가산정·자동차세 포함·보험 0·CM/AG 수수료 0·공채할인 0. 리스료는 부가세 없음.
// 셀 추적: 리스수식 W2~W15(취득원가), AA29(잔가), AA48(PMT), AA51(매회리스료), AA52(납부리스료), 운용리스_입력 AZ32(이율).

import { roundUp, roundDown, roundE, pmt } from "./calc";

const trunc1 = (v: number) => Math.trunc(v / 10) * 10; // TRUNC(v, -1)

/** 트림 1건의 계산 입력 (차량정보 시트 F~AZ에서 파싱). */
export interface MeritzLeaseTrim {
  manufacturer: string;  // 제조사(G)
  name: string;          // 차종(H)
  kind: string;          // 종류(I): 승용/RV(5인이하)/RV(7-10인)/RV(11-12인)/소형화물(1톤)/경차
  discountRate: number;  // 특판할인율(J)
  fuel: string;          // 연료(K): 가솔린/디젤/하이브리드/EV/LPG
  disp: number;          // 배기량(M)
  carTaxAnnual: number;  // 연간 자동차세(N) — 엑셀에 선계산 컬럼
  residual: Record<string, number>; // 잔가율 `${months}_${distKm}` → 0~1 (O~AL 그리드)
  gaesoseExempt: boolean;           // 개소세(AN) = "면제"
  deliveryFeeSeoul: number;         // 서울/경기/인천 탁송료(AP)
  evSubsidy: number;                // EV 국비+추가 보조금(리스수식 P25:Q101 + P107:Q198)
}

// 통합취득세율(리스수식 J45:K52) — 개인 기준. 경차는 별도 분기.
const ACQ_RATE: Record<string, number> = {
  "승용": 0.07, "RV(5인이하)": 0.07, "RV(7-10인)": 0.07, "EV": 0.07, "하이브리드": 0.07,
  "RV(11-12인)": 0.05, "소형화물(1톤)": 0.05,
};

const STD = {
  sundry: 141500,        // 부대비용계(T3): 등록대행33,000+세차66,000+번호판15,000+보조번호판11,000+인지대16,500
  feeFixed: 10000,       // 수수료점검 고정분(AA39 말미 +10000)
  baseRate: 0.06,        // 적용이율(운용리스_입력 AZ32) — 특판출고 6%
  advRateSurcharge: 0.003, // 총선수율 39% 초과 시 +0.3%
  evAcqReduce: 1400000,  // EV 취득세 감면(I51)
  gaesoseK: 1.1572,      // 개소세 계산 분모(K80 수식 고정값)
  gaesoseRate: 0.04,     // '26.7 이후 출고 개소세율(J80)
  hevGaesoseCap: 700000, // HEV 개소세 감면 한도(K86)
  evGaesoseCap: 3000000, // EV 개소세 감면 한도(K88)
};

const isEv = (t: MeritzLeaseTrim) => t.fuel === "EV";
// EV 취득세 감면 예외(I51): GV60 21인치·더 뉴 EV6 GT 는 감면 없음
const evAcqReduceExempt = (name: string) =>
  (name.startsWith("GV60") && name.endsWith("21인치")) || name.startsWith("더 뉴 EV6 GT");

/** 친환경 개소세 감면 + 교육세 + 부가세(K91) — 특판할인가격에 가산되는 감면분. */
function greenDiscountAdd(t: MeritzLeaseTrim, price: number): number {
  if (t.fuel !== "EV" && t.fuel !== "하이브리드") return 0;
  const k80 = t.gaesoseExempt
    ? 0
    : Math.floor(((price - price * t.discountRate) / STD.gaesoseK) * STD.gaesoseRate * 10) / 10; // ROUNDDOWN(…,1)
  const cap = t.fuel === "EV" ? STD.evGaesoseCap : STD.hevGaesoseCap;
  const k90 = Math.min(k80, cap);
  return roundE(k90 * 1.3 * 1.1, -3); // ROUND(감면×1.3×1.1, -3)
}

/** 총취득원가(W15) = 세금계산서(W9=차량가격) + 통합취득세(W12) + 부대·탁송(L2). 공채할인 0 표준. */
export function computeLeaseAcqCost(t: MeritzLeaseTrim, price: number): number {
  const discount = roundDown(price * t.discountRate, -3) + greenDiscountAdd(t, price); // W5(특판)
  const w2 = price - discount;      // 차량가격
  const w10 = w2 / 1.1;             // 공급가액
  let acqTax: number;               // 통합취득세(W12)
  if (t.kind === "경차") {
    acqTax = w10 <= 18750000 ? 0 : trunc1(w10 * 0.04) - 750000;
  } else {
    const reduce = isEv(t) && !evAcqReduceExempt(t.name) ? STD.evAcqReduce : 0;
    acqTax = trunc1(w10 * (ACQ_RATE[t.kind] ?? 0.07)) - reduce;
  }
  return w2 + acqTax + STD.sundry + t.deliveryFeeSeoul; // W9 + W11 + L2
}

/** 차량가격(W2) = 주입가 − 특판할인(감면 포함). 잔가·보증금 산정 기준. */
export function leaseVehiclePrice(t: MeritzLeaseTrim, price: number): number {
  return price - (roundDown(price * t.discountRate, -3) + greenDiscountAdd(t, price));
}

/**
 * 트림 1건의 매회 납부리스료 — 표준조건, 지정 (기간×거리). 잔가율 없으면 null.
 * 보증금(AA26)·장기선수금(AA37)은 차량가(W2) 기준 비율 → ROUNDUP(…,-3) 금액.
 * AA48 = ROUNDUP(PMT(이율/12, n, −(W15 − 보조금 + 수수료 − 보증금 − 선수금), 잔가 − 보증금), -1) + 선수금/n
 * 납부리스료(AA52) = AA48 + 자동차세월분 − 선수금/n.
 */
export function computeMonthlyLease(
  t: MeritzLeaseTrim, price: number, months: number, distKm: number,
  opts: { depositRate?: number; prepayRate?: number } = {}
): number | null {
  const r = t.residual[`${months}_${distKm}`];
  if (r === undefined || r <= 0) return null;

  const w2 = leaseVehiclePrice(t, price);
  const w15 = computeLeaseAcqCost(t, price);
  const residualValue = roundUp(w2 * r, -3);                       // AA29(계약잔가, 차량가기준)
  const deposit = opts.depositRate ? roundUp(w2 * opts.depositRate, -3) : 0;  // AA26
  const prepay = opts.prepayRate ? roundUp(w2 * opts.prepayRate, -3) : 0;     // AA37
  const prepayMonthly = prepay > 0 ? roundDown(prepay / months, -1) : 0;      // |Z37|
  const advRate = (deposit + prepay) / w2;                          // 총선수율(Z56)
  const rate = STD.baseRate + (advRate > 0.39 ? STD.advRateSurcharge : 0);    // AZ32
  const subsidy = isEv(t) ? t.evSubsidy : 0;                        // Q19

  const pmtTerm = roundUp(
    pmt(rate / 12, months, -(w15 - subsidy + STD.feeFixed - deposit - prepay), residualValue - deposit, 0),
    -1
  );
  const aa48 = pmtTerm + prepayMonthly;
  const carTaxMonthly = roundUp(t.carTaxAnnual / 12, -1);           // AA50
  const aa51 = aa48 + carTaxMonthly;                                // 매회리스료(보험 0)
  return aa51 - prepayMonthly;                                      // 납부리스료(AA52)
}
