// 메리츠캐피탈 수입신차견적 .xlsm 금융리스/할부 월납입금 계산기 — '금융리스 내부'/'할부 내부' 시트 수식 재현.
// 월납입금(내부 H18/H19) = ROUNDUP(PMT(금리/12, 기간, -이용금액, 유예·잔가최종), -1)
//  - 이용금액(H4) = 차량가최종 − 선수금(비율모드: 차량가×비율, 금액모드: 입력액. 라운딩 없음)
//  - 이용금액 < 20,000,000 → "불가"(입력 J21/J19)
//  - 등록비용(취득세·공채·탁송·부대)은 별도 청구라 월납입금과 무관. 유예/잔가는 체크 옵션(표준 미사용 0).
//  - CM/AG/인지세/설정비는 IRR 자기검증 루프(내부 H26~H31)에만 쓰여 고객 월납입금에 미반영.
// 금리: 워크북에 정책표 없음 — 노란색 수기입력('금융리스 입력' J22 / '할부 입력' J20)이 유일한 근거.
// 검증(배포 캐시): 금융리스 6,500만·선수 20%(이용 5,200만) @6.3% → 36: 1,589,020 / 48: 1,228,390 / 60: 1,012,580
//  할부 6,500만 @7.3% → 36·이용 5,200만: 1,612,760 / 48·이용 5,500만: 1,324,720
//  (할부 조건3 캐시 1,012,580은 시트 버그로 '금융리스 입력' X22=6.3%를 참조한 값)
import { pmt, roundUp } from "../mg/calc";

export const MERITZ_IMPORT_FINANCE_TERMS = [12, 24, 36, 48, 60] as const;
const MIN_PRINCIPAL = 20000000;

/** 금융리스/할부 공용 월납입금. 이용금액 2천만 미만·금리 미입력은 취급불가 null. */
export function computeMonthlyImportFinance(
  price: number, months: number, annualRate: number,
  opts: { downPaymentRate?: number; downPaymentAmount?: number } = {}
): number | null {
  if (price <= 0 || annualRate <= 0) return null;
  if (!MERITZ_IMPORT_FINANCE_TERMS.includes(months as (typeof MERITZ_IMPORT_FINANCE_TERMS)[number])) return null;
  const down = opts.downPaymentAmount ?? (opts.downPaymentRate ? price * opts.downPaymentRate : 0); // H6/I6
  const principal = price - down; // H4
  if (principal < MIN_PRINCIPAL) return null;
  return roundUp(pmt(annualRate / 12, months, -principal, 0), -1); // H18/H19 (유예 0)
}
