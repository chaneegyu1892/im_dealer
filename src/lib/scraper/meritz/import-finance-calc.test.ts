import { describe, it, expect } from "vitest";
import { computeMonthlyImportFinance } from "./import-finance-calc";

// 검증 기준: 배포 엑셀(메리츠 수입신차견적 26.07 V2) '금융리스/할부 입력' 시트의 살아있는 캐시값 원단위 대조.
// 금융리스 저장 상태: BYD DOLPHIN 차량가최종 65,000,000, 선수금 20% → 이용금액 52,000,000, 금리 6.3%
// 할부 저장 상태: Benz CLE 200 Coupe 65,000,000 — 조건1 36개월 이용 52,000,000 @7.3% /
//   조건2 48개월 선수금액 10,000,000(이용 55,000,000) @7.3% / 조건3 60개월 이용 52,000,000 @6.3%(시트 버그로 금융리스 금리 참조)
const PRICE = 65000000;

describe("meritz import finance/installment calculator", () => {
  it("금융리스 36/48/60개월 @6.3% 선수 20% = 1,589,020 / 1,228,390 / 1,012,580", () => {
    const opts = { downPaymentRate: 0.2 };
    expect(computeMonthlyImportFinance(PRICE, 36, 0.063, opts)).toBe(1589020);
    expect(computeMonthlyImportFinance(PRICE, 48, 0.063, opts)).toBe(1228390);
    expect(computeMonthlyImportFinance(PRICE, 60, 0.063, opts)).toBe(1012580);
  });
  it("할부 조건1: 36개월 @7.3% 선수 20% = 1,612,760", () => {
    expect(computeMonthlyImportFinance(PRICE, 36, 0.073, { downPaymentRate: 0.2 })).toBe(1612760);
  });
  it("할부 조건2: 48개월 @7.3% 선수금액 10,000,000 = 1,324,720", () => {
    expect(computeMonthlyImportFinance(PRICE, 48, 0.073, { downPaymentAmount: 10000000 })).toBe(1324720);
  });
  it("할부 조건3(캐시는 시트 버그로 6.3%): 60개월 @6.3% 선수 20% = 1,012,580", () => {
    expect(computeMonthlyImportFinance(PRICE, 60, 0.063, { downPaymentRate: 0.2 })).toBe(1012580);
  });
  it("이용금액 2,000만 미만은 취급불가 null (경계 2,000만은 가능)", () => {
    expect(computeMonthlyImportFinance(30000000, 36, 0.063, { downPaymentAmount: 10000001 })).toBeNull();
    expect(computeMonthlyImportFinance(30000000, 36, 0.063, { downPaymentAmount: 10000000 })).not.toBeNull();
  });
  it("금리 미입력(0)·미지원 기간(72)은 null", () => {
    expect(computeMonthlyImportFinance(PRICE, 36, 0)).toBeNull();
    expect(computeMonthlyImportFinance(PRICE, 72, 0.063)).toBeNull();
  });
});
