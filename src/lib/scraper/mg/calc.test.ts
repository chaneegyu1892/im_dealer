import { describe, it, expect } from "vitest";
import { computeMonthlyRent, residualRate, type MgTrim } from "./calc";

// 검증 기준: 배포 엑셀(렌터카 20260702) 선택차 캐시값 원단위 대조.
// 더뉴_그랜저_2.5_(가솔린), 30,000,000, 특소세1.1572, 승용 2497cc, 잔가군키(CD21)=1.
const GRANGER: MgTrim = {
  manufacturer: "현대자동차", name: "더뉴_그랜저_2.5_(가솔린)", disp: 2500, fuel: "가솔린", teuksoK: 1.1572, vehClass: "승용",
  residualBase: { 36: 0.58, 48: 0.51, 60: 0.39 },
  rvSpecial: 0.12, rvEvent: 0, rvAdd48: 0, rvAdd60: 0.04,
  rate: { 36: 0.05, 48: 0.05, 60: 0.05 },
  insuranceAnnual: 757190, deliveryFee: 372500, maintMonthly: 23170,
};

describe("mg rent calculator", () => {
  it("잔가율 36/48/60 @2만 = 0.71/0.64/0.56", () => {
    expect(residualRate(GRANGER, 36, 20000)).toBeCloseTo(0.71, 10);
    expect(residualRate(GRANGER, 48, 20000)).toBeCloseTo(0.64, 10);
    expect(residualRate(GRANGER, 60, 20000)).toBeCloseTo(0.56, 10);
  });
  it("36개월/2만km 월 대여료 = 493,570", () => {
    expect(computeMonthlyRent(GRANGER, 30000000, 36, 20000)).toBe(493570);
  });
});
