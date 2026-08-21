// 메리츠캐피탈 수입신차 운용리스 리스료 계산기 — 배포 엑셀(수입신차견적 2607 V2) '운용리스 내부' 수식을 코드로 재현.
// 검증: Audi A6 40 TFSI S-Line 80,000,000 / 보증금12%·잔가 0.49/0.41/0.35(배포 캐시 상태)
//       → 36/48/60개월 리스료 1,644,700 / 1,424,700 / 1,264,400 (H30 원단위 일치).
// 표준조건(수입=비제휴 ../standard-conditions.ts): 보증금/선수금 0(저보증금 금리 가산 +0.15% 적용)·
// 잔가=잔가보장 5사 랭킹 선택 최대잔가·공채 0(수원)·차세 미포함·CM 2%+추가수수료 1%(배포 기본)·
// AG/제휴/본부장 0·인지세 10,000·전기차보조금 0(딜러 확인 후 입력 구조라 미반영).
import { pmt, roundDown, roundUp } from "../mg/calc";
import {
  IMPORT_LEASE_TERMS, RESIDUAL_COMPANIES,
  type MeritzImportLeaseConsts, type MeritzImportLeaseTrim, type ResidualCompany,
} from "./import-lease-parse";

// 잔가보장수수료 구간별 요율(잔가 시트 C36:G45 수식 상수) — 차량가 × 요율, ROUNDDOWN(-2). 0~8구간.
const FEE_RATES: Record<ResidualCompany, number[]> = {
  west: [0, 0.0015, 0.003, 0.0045, 0.006, 0.0075, 0.009, 0.0105, 0.011],
  aj: [0, 0, 0, 0, 0, 0.006, 0.008, 0.01, 0.011],
  aps: [0, 0.001, 0.003, 0.005, 0.007, 0.009, 0.011, 0.012, 0.013],
  vgs: [0, 0.001, 0.003, 0.005, 0.008, 0.009, 0.01, 0, 0], // 7·8구간 없음, 상한 150만
  self: [0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const VGS_FEE_CAP = 1500000;

/** 잔가구간(잔가 시트 O열): 계약잔가율 − 일반잔가율 차이 → 0~8구간. */
function feeBand(diff: number): number {
  if (diff > 0.0701) return 8;
  if (diff > 0.0601) return 7;
  if (diff > 0.0501) return 6;
  if (diff > 0.0401) return 5;
  if (diff > 0.0301) return 4;
  if (diff > 0.0201) return 3;
  if (diff > 0.0101) return 2;
  if (diff >= 0.0001) return 1;
  return 0;
}

function guaranteeFee(company: ResidualCompany, band: number, price: number): number {
  const fee = roundDown(price * FEE_RATES[company][band], -2);
  return company === "vgs" ? Math.min(fee, VGS_FEE_CAP) : fee;
}

interface CompanyResidual {
  company: ResidualCompany;
  normal: number; // K: 기본잔가율 + 주행거리 가감 (일반잔가)
  max: number;    // M: 고잔가 반영 최고잔가
}

/** 회사별 일반/최고 잔가율(잔가 시트 I~M열 재현). 잔가군 미등재(기본잔가 0) 회사는 제외. */
function companyResiduals(t: MeritzImportLeaseTrim, consts: MeritzImportLeaseConsts, months: number, distKm: number): CompanyResidual[] {
  const stdKm = distKm === 10000 || distKm === 15000 || distKm === 20000;
  const out: CompanyResidual[] = [];
  for (const company of RESIDUAL_COMPANIES) {
    const base = consts.grids[company][t.grades[company]]?.[months] ?? 0;
    if (base <= 0) continue;
    const adj = distKm === 30000 ? (company === "self" ? -0.15 : -0.04) : stdKm ? 0 : NaN;
    if (Number.isNaN(adj)) continue; // 지원 외 주행거리
    const normal = base + adj;
    // 고잔가율: 1~2만km·12~60개월에서 West/AJ/APS 8%, VGS 6%, 자체 0 (고잔가불가 차량은 0)
    const hi = t.highResidualBlocked || !stdKm ? 0 : company === "vgs" ? 0.06 : company === "self" ? 0 : 0.08;
    // 고잔가추가(차종 Q/R열): 1.5만 미만·1만 미만 가산 — AJ·자체잔가 행 수식에만 존재
    const extra = company === "aj" || company === "self"
      ? (distKm < 20000 ? t.hiResExtra15k : 0) + (distKm < 15000 ? t.hiResExtra10k : 0)
      : 0;
    out.push({ company, normal, max: hi + normal + extra });
  }
  return out;
}

export interface ImportLeaseResidualPick {
  company: ResidualCompany;
  rate: number;   // 계약잔가율(표준: 후보 중 최고잔가율)
  normal: number; // 선택사의 일반잔가율 — 잔가구간(수수료) 산정 기준
}

/** 잔가보장사 랭킹 선택(잔가 시트 F~W열 재현): 최고잔가 내림차순 랭크 + 수수료 오름차순 랭크(+2 페널티) 합산 최소.
 *  계약잔가율은 후보 중 최고잔가율로 고정(카탈로그 표준) — 배포 파일의 계약잔가는 딜러 입력값이라 표준화 필요. */
export function pickImportLeaseResidual(
  t: MeritzImportLeaseTrim, consts: MeritzImportLeaseConsts, price: number, months: number, distKm: number,
  contractRate?: number
): ImportLeaseResidualPick | null {
  const cands = companyResiduals(t, consts, months, distKm);
  if (cands.length === 0) return null;
  const contract = contractRate ?? Math.max(...cands.map((c) => c.max));
  const fees = cands.map((c) => guaranteeFee(c.company, feeBand(contract - c.normal), price));
  const rankDesc = (v: number, arr: number[]) => arr.filter((x) => x > v).length + 1; // Excel RANK(내림)
  const rankAsc = (v: number, arr: number[]) => arr.filter((x) => x < v).length + 1;  // Excel RANK(오름)
  const maxes = cands.map((c) => c.max);
  const scored = cands.map((c, i) => {
    const u = rankDesc(c.max, maxes);
    const v = rankAsc(fees[i], fees) + (u > 1 ? 2 : 0);
    return { c, w: u + v };
  });
  const minW = Math.min(...scored.map((s) => s.w));
  const chosen = scored.find((s) => s.w === minW)!.c; // 동률 시 잔가 시트 행 순서(West→자체) 우선
  return { company: chosen.company, rate: contract, normal: chosen.normal };
}

/** 취득세(취득세 시트 C8 재현): 구분별 요율 × 과세표준(차량가/1.1) ROUNDDOWN(-1) − 전기차 감면. */
export function importLeaseAcqTax(t: MeritzImportLeaseTrim, price: number, consts: MeritzImportLeaseConsts): number {
  const row = consts.acqTaxTable[t.taxClass] ?? { rate: 0.07, evReduction: 0 };
  return roundDown((price / 1.1) * row.rate, -1) - row.evReduction;
}

/** 취득원가(내부 H8): 차량가 + 취득세 + 공채(표준 수원=0) + 탁송료 + 부대비. */
export function computeImportLeaseAcqCost(t: MeritzImportLeaseTrim, price: number, consts: MeritzImportLeaseConsts): number {
  return price + importLeaseAcqTax(t, price, consts) + consts.deliveryFee + consts.incidentalFee;
}

/** 월 리스료(내부 H30=H51, 차세 미포함) — 표준조건, 지정 (기간×거리). 산출 불가 시 null.
 *  H52 = ROUNDUP(PMT(IRR/12, n, −취득원가+보증금+선수금−CM−잔가보장수수료−추가수수료−인지세1만, 잔가−보증금), -2)
 *  선수금은 회차균등액을 리스료에 합산 후 최종 표시에서 차감(H51−H32). 검증용으로 계약잔가율 직접 지정 가능. */
export function computeMonthlyImportLease(
  t: MeritzImportLeaseTrim, price: number, months: number, distKm: number, consts: MeritzImportLeaseConsts,
  opts: { depositRate?: number; prepayRate?: number; contractResidualRate?: number } = {}
): number | null {
  if (price <= 0 || !IMPORT_LEASE_TERMS.includes(months as (typeof IMPORT_LEASE_TERMS)[number])) return null;
  const pick = pickImportLeaseResidual(t, consts, price, months, distKm, opts.contractResidualRate);
  if (!pick) return null;
  const residual = roundDown(price * pick.rate, -3); // 입력 L13: ROUNDDOWN(차량가×잔가율, -3)
  if (residual <= 0) return null;

  const deposit = opts.depositRate ? roundDown(price * opts.depositRate, -3) : 0;
  const prepay = opts.prepayRate ? roundDown(price * opts.prepayRate, -3) : 0;

  const base = consts.irrByBrand[t.manufacturer];
  if (!base || base <= 0) return null; // 브랜드 IRR 미등재/0 = 취급불가(엑소틱·BYD 등)
  const irr = base
    + ((deposit + prepay) / price < 0.11 ? consts.lowDepositSurcharge : 0) // 저보증금 가산(내부 H36)
    + (t.name === "Polestar 4 Long range Dual motor" ? 0.017 : 0);

  const acqCost = computeImportLeaseAcqCost(t, price, consts);
  const fee = guaranteeFee(pick.company, feeBand(pick.rate - pick.normal), price); // 잔가 시트 D13
  const cm = roundDown(consts.cmFeeRate * acqCost, -1);      // 내부 I18
  const extraFee = roundDown(consts.extraFeeRate * acqCost, -1); // 내부 J27
  const principal = -acqCost + deposit + prepay - cm - fee - extraFee - 10000; // 내부 H52 원금항(AG/제휴/본부장/설정비/이손 0)
  const raw = pmt(irr / 12, months, principal, residual - deposit);
  if (raw <= 0) return null;
  const h52 = roundUp(raw, -2);
  const h51 = roundDown(h52 + prepay / months, -1);       // 리스료(선납제외)
  const h32 = roundDown(prepay / months, -1);             // 선납금차감
  return h51 - h32;                                        // 최종리스료(차세 미포함)
}
