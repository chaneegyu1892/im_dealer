// MG캐피탈 수입견적 금융리스/할부오토론 월납입금 계산기 — 배포 엑셀(수입견적 2606 vol1) 숨김 시트 수식 재현.
// 배포 파일의 최종값 캐시는 전부 스테일(42)이라 중간값 캐시로 검증:
//  - 금융리스 A250(5,000만): 취득세 3,181,810 / 총구매비용 53,381,810(캐시, 탁송·등록 10만+10만 포함 상태)
//  - 할부 EV(7,040만, disp=1): 취득세 3,730,000(경차특례 -75만 차감) / 설정금액 74,130,000 / 설정료 444,780 / 인지세 35,000
// PMT→RATE→재PMT 기계는 운용리스(740i 2,062,000 원단위 일치)에서 검증된 것을 재사용.
// 표준조건: 금융리스=당사명의(IRR H열), 할부=이용자명의(IRR J열, 배포 기본 BD15). 선수금 차량가비율,
// 공채/탁송/등록비 0, 유예·보증금 0, AG/CM/제휴/기타/용품 0. 잔가·주행거리 개념 없음.
import { pmt, roundDown, roundE, roundUp } from "./calc";
import { rateSolve } from "./import-calc";
import { LEASE_TERMS, normBrandKey, type MgImportConsts, type MgImportTrim } from "./import-parse";

/** 금융리스/할부 취득세(CI21) — 운용리스와 달리 1000cc 미만은 면제가 아니라 75만원 '차감'(CI15).
 *  하이브리드 -40만 분기(CI16)는 차량DB에 해당 값이 없어 사문. */
export function financeAcqTax(t: MgImportTrim, price: number): number {
  const major = t.vehClass.slice(0, 2);
  const taxRate = major === "승합" || major === "화물" ? 0.05 : 0.07; // CI13
  const ci14 = roundDown((price / 1.1) * taxRate, -1);
  if (t.disp < 1000) return ci14 < 750000 ? 0 : ci14 - 750000; // CI15
  return ci14;
}

const FINANCE_STAMP_DUTY = 10000; // 금융리스 CI80 (상수)

/** 할부 인지세(CI80) — 할부원금 구간 VLOOKUP(CL79:CM81, 근사매치). */
export function installmentStampDuty(principal: number): number {
  return principal >= 100000001 ? 75000 : principal >= 50000001 ? 35000 : 0;
}

/** 할부 이용자명의 설정료(CI83) — 설정율 1(배포 기본 BD26) 기준 설정금액 = ROUNDUP(원금,-4) (CL83:CM87). */
export function installmentMortgageFee(principal: number): number {
  const amount = roundUp(principal, -4); // CI81
  if (amount === 0) return 0;
  return roundDown(amount >= 7500000 ? amount * 0.006 : amount * 0.004 + 15000, 0); // CI82
}

/** 공통 현금흐름 체인(CQ26→CQ27→CQ29→CQ28→AG11): 원금+수수료로 PMT(IRR) → 표시금리(RATE, 원금 기준)
 *  → 재PMT 원시값을 그대로 ROUNDUP(-2). 운용리스와 달리 ROUNDDOWN 후 올림이 아님. */
function monthlyFromChain(irr: number, months: number, principal: number, extras: number): { monthly: number; dispRate: number } | null {
  const minus = principal + extras;                                   // CQ17 (PLUS CQ22=0, 유예·보증금 0)
  const cq26 = roundDown(pmt(irr / 12, months, -minus, 0), 0);        // CQ26
  if (cq26 <= 0) return null;
  const solved = rateSolve(months, cq26, -principal, 0);              // CQ27
  if (solved === null) return null;
  const dispRate = roundE(solved * 12, 5);                            // CQ29
  const raw = pmt(dispRate / 12, months, -principal, 0);              // CQ28
  return { monthly: roundUp(raw, -2), dispRate };                     // AG11
}

/** 금융리스 월납입금(AG11) — 당사명의 표준: 설정료 0, 인지세 1만. 브랜드 IRR(H열) 없으면 취급불가 null. */
export function computeMonthlyMgFinanceLease(
  t: MgImportTrim, price: number, months: number, consts: MgImportConsts,
  opts: { depositRate?: number } = {}
): number | null {
  if (price <= 0 || !LEASE_TERMS.includes(months as (typeof LEASE_TERMS)[number])) return null;
  const irr = consts.irrFinanceByBrand[normBrandKey(t.manufacturer)];
  if (!irr) return null;
  const deposit = opts.depositRate ? roundDown(price * opts.depositRate, -3) : 0; // CI33(차량가비율)
  const principal = price + financeAcqTax(t, price) - deposit;                    // CI23
  if (principal <= 0) return null;
  return monthlyFromChain(irr, months, principal, FINANCE_STAMP_DUTY)?.monthly ?? null;
}

/** 할부오토론 월납입금(AG11) — 이용자명의 표준: 설정료+인지세(원금구간) 반영.
 *  표시금리 19.5% 초과는 엑셀 '금리기준초과' → null. */
export function computeMonthlyMgInstallment(
  t: MgImportTrim, price: number, months: number, consts: MgImportConsts,
  opts: { depositRate?: number } = {}
): number | null {
  if (price <= 0 || !LEASE_TERMS.includes(months as (typeof LEASE_TERMS)[number])) return null;
  const irr = consts.irrInstallmentByBrand[normBrandKey(t.manufacturer)];
  if (!irr) return null;
  const deposit = opts.depositRate ? roundDown(price * opts.depositRate, -3) : 0; // CI33(차량가비율)
  const principal = price + financeAcqTax(t, price) - deposit;                    // CI23
  if (principal <= 0) return null;
  const extras = installmentMortgageFee(principal) + installmentStampDuty(principal); // CQ15+CQ16
  const r = monthlyFromChain(irr, months, principal, extras);
  if (!r || r.dispRate > 0.195) return null; // AG11 IF(BD30>19.5%,"금리기준초과")
  return r.monthly;
}
