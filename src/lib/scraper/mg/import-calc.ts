// MG캐피탈 수입 운용리스 월납입금 계산기 — 배포 엑셀(수입견적 26.07월 외부용 2606 vol1) 운용리스 시트 수식 재현.
// 검증: BMW 740i xDrive DPE 계산서가 160,800,000 / 60개월·2만km → 월납입금 2,062,000 (AG14 원단위 일치).
// 표준조건(수입=비제휴 ../standard-conditions.ts): 비제휴사·당사명의·보증/선납 0·잔가=최대잔가율(차량가 기준)·
// 공채/부대비/탁송 0(배포 기본 상태)·자동차세 미포함(별도청구)·AG/CM/제휴/기타비용 0.
import { pmt, roundDown, roundE, roundUp } from "./calc";
import { LEASE_TERMS, normBrandKey, type MgImportConsts, type MgImportTrim } from "./import-parse";

/** Excel RATE(nper, pmt, pv, fv) — 이분법(월이율 0~1 구간). 해 없으면 null. */
export function rateSolve(nper: number, payment: number, pv: number, fv: number): number | null {
  const f = (r: number) => pv * Math.pow(1 + r, nper) + (payment * (Math.pow(1 + r, nper) - 1)) / r + fv;
  let lo = 1e-12, hi = 1;
  const fLo = f(lo), fHi = f(hi);
  if (fLo === 0) return lo;
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) * fLo > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 주행거리별 잔가 가감(운용리스 CQ59/CQ60/CQ61) — 회사별 IF 체인 재현. */
function mileageAdjusted(company: "snk" | "aps" | "chabot", base: number, distKm: number): number {
  if (company === "snk") {
    return distKm === 35000 ? base - 0.02 : distKm === 30000 ? base - 0.05 : distKm === 20000 ? base : distKm === 10000 ? base + 0.005 : 0;
  }
  if (company === "aps") {
    return distKm === 35000 ? base - 0.02 : distKm === 30000 ? base - 0.09 : distKm === 20000 ? base : distKm === 10000 ? base + 0.01 : 0;
  }
  // 차봇: 2만=기본, 3만=-6%, 1만=기본, 그 외 2% (엑셀 CQ61 원문 그대로)
  return distKm === 20000 ? base : distKm === 30000 ? base - 0.06 : distKm === 10000 ? base : 0.02;
}

export interface ResidualPick {
  company: "snk" | "aps" | "chabot";
  /** 최대잔가율(CR62) — 주행거리 가감 + 고잔가 +8% + 엑셀 동률방지 미소가산 포함. 견적 잔가율로 사용. */
  rate: number;
}

/** 잔가보장 3사(SNK/APS/차봇) 중 최대잔가율 회사 선택(운용리스 CO59:CS62 재현).
 *  기본잔가율(잔가군/차봇 값)이 없는 회사는 후보 제외 — 잔가군 미등재 차량이 '+8%만으로' 견적되는 것을 차단. */
export function pickResidual(t: MgImportTrim, consts: MgImportConsts, months: number, distKm: number): ResidualPick | null {
  const bases: Record<"snk" | "aps" | "chabot", number> = {
    snk: (consts.snkMap[t.snkGrade]?.[months] ?? 0) + t.snkPromo,   // CP59
    aps: (consts.apsMap[t.apsGrade]?.[months] ?? 0) + t.apsPromo,   // CP60
    chabot: t.chabot[months] ?? 0,                                   // CP61
  };
  // 동률방지 미소가산(엑셀 CR59/CR60=+1e-11, CR61=+1e-9)까지 재현 — 부동소수 잔가율의 ROUNDDOWN 경계 일치에 필요.
  const eps: Record<"snk" | "aps" | "chabot", number> = { snk: 1e-11, aps: 1e-11, chabot: 1e-9 };
  const candidates = (Object.keys(bases) as ("snk" | "aps" | "chabot")[])
    .filter((c) => bases[c] > 0)
    .map((c) => {
      const adj = mileageAdjusted(c, bases[c], distKm);
      return { company: c, rate: (t.highResidual ? adj + 0.08 : adj) + eps[c] };
    })
    .filter((c) => c.rate > 0)
    .sort((a, b) => b.rate - a.rate);
  return candidates.length > 0 ? { company: candidates[0].company, rate: candidates[0].rate } : null;
}

/** 최종 취득세(CI21, 자동반영 경로) — 승용 7%·승합/화물 5%, 1000cc 미만 경차특례(75만 미만 면제). */
export function importAcqTax(t: MgImportTrim, price: number): number {
  const major = t.vehClass.slice(0, 2);
  const taxRate = major === "승합" || major === "화물" ? 0.05 : 0.07; // CI13
  const ci14 = roundDown((price / 1.1) * taxRate, -1);
  if (t.disp < 1000) return ci14 < 750000 ? 0 : ci14; // CI15
  return ci14;
}

/** 취득원가(CI23) = 계산서가 + 취득세 (표준: 공채비용·부대비·탁송료 0). */
export function computeImportAcqCost(t: MgImportTrim, price: number): number {
  return price + importAcqTax(t, price);
}

/** 월납입금(견적서 AG14, VAT 없음 — 리스) — 표준조건, 지정 (기간×거리). 잔가 산출 불가 시 null.
 *  현금흐름(CQ열): 투자원금 = 취득원가 + 잔가보장수수료 + 인지세 → PMT(IRR 5%) → 표시금리(RATE, 취득원가 기준)
 *  재산정 → 월리스료 ROUNDDOWN → ROUNDUP(-2). 보증금은 PMT 원금/만기 차감 후 표시금리로 흡수(CQ26→CQ28→CQ29),
 *  선납금은 표시금리 재산정 없이 회차균등액 가감(CQ32=CQ26+CQ31, AG14=ROUNDUP(CQ32,-2)−CQ31). */
export function computeMonthlyImportLease(
  t: MgImportTrim, price: number, months: number, distKm: number, consts: MgImportConsts,
  opts: { depositRate?: number; prepayRate?: number } = {}
): number | null {
  if (price <= 0 || !LEASE_TERMS.includes(months as (typeof LEASE_TERMS)[number])) return null;
  const pick = pickResidual(t, consts, months, distKm);
  if (!pick) return null;

  const irr = consts.irrByBrand[normBrandKey(t.manufacturer)] ?? 0.05; // CI25 (비제휴 가산 0)
  const acqCost = computeImportAcqCost(t, price);                       // CI23
  const residual = roundDown(price * pick.rate, -3);                    // CI40(차량가비율) → CI42
  if (residual <= 0) return null;
  // 잔가보장수수료(CI55) — 고잔가 Y 차량만, 표준(잔가=최대)은 잔가GAP 0 구간 요율. 차봇은 0.
  const feeRate = pick.company === "snk" ? consts.gapFeeRate.snk : pick.company === "aps" ? consts.gapFeeRate.aps : 0;
  const guaranteeFee = t.highResidual ? roundDown(price * feeRate, 0) : 0;
  const invest = acqCost + guaranteeFee + consts.stampDuty;             // CP17=CQ17

  const deposit = opts.depositRate ? roundDown(price * opts.depositRate, -3) : 0; // CI28
  const prepay = opts.prepayRate ? price * opts.prepayRate : 0;                    // CI26(금액 직접입력)
  const cq26 = pmt(irr / 12, months, -(invest - deposit - prepay), residual - deposit);
  if (cq26 <= 0) return null;

  if (prepay > 0) {
    const prepayMonthly = roundDown(prepay / months, 0); // CQ31
    return roundUp(cq26 + prepayMonthly, -2) - prepayMonthly; // AG10+AG11
  }
  const solved = rateSolve(months, cq26, -acqCost, residual); // CQ27 (선납 0)
  if (solved === null) return null;
  const dispRate = roundE(solved * 12, 5);                             // CQ28
  const monthly = roundDown(pmt(dispRate / 12, months, -acqCost, residual), 0); // CQ29=CQ32
  return roundUp(monthly, -2);                                          // AG10=AG14
}
