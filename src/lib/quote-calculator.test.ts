import { describe, it, expect } from "vitest";
import {
  calculateMultiFinanceQuote,
  getRateFromMatrix,
  type RateConfigData,
  type CalcInput,
} from "./quote-calculator";

describe("quote-calculator", () => {
  const mockRateConfig: RateConfigData = {
    financeCompanyId: "fc_mock_1",
    financeCompanyName: "테스트 캐피탈",
    financeSurchargeRate: 0,
    minVehiclePrice: 20000000,
    maxVehiclePrice: 50000000,
    minRateMatrix: {
      "36_10000": 0.015,
      "36_20000": 0.016,
      "36_30000": 0.017,
      "48_10000": 0.013,
      "48_20000": 0.014, // 48개월, 2만km 기준 1.4%
      "48_30000": 0.015,
      "60_10000": 0.011,
      "60_20000": 0.012,
      "60_30000": 0.013,
    },
    maxRateMatrix: {
      "36_10000": 0.015,
      "36_20000": 0.016,
      "36_30000": 0.017,
      "48_10000": 0.013,
      "48_20000": 0.014, // min과 max를 동일하게 설정하여 선형 보간 무시
      "48_30000": 0.015,
      "60_10000": 0.011,
      "60_20000": 0.012,
      "60_30000": 0.013,
    },
    depositDiscountRate: -0.0005, // 보증금 10%당 0.05% 할인 (음수 저장)
    prepayAdjustRate: 0.0002,     // 선납금 10%당 추가 0.02% 할인 (양수 저장, CLAUDE.md 규칙)
  };

  const defaultInput: CalcInput = {
    vehiclePrice: 30000000, // 3,000만 원
    contractMonths: 48,
    annualMileage: 20000,
    depositRate: 0,
    prepayRate: 0,
    vehicleSurchargeRate: 0,
    rankSurchargeRates: [0, 0, 0], // 순위 가산율 없음
    rateConfigs: [mockRateConfig],
  };

  describe("기본 견적 계산 (무보증, 무선납)", () => {
    it("차량가 * 회수율 공식을 정확히 계산해야 한다", () => {
      const results = calculateMultiFinanceQuote(defaultInput);
      
      expect(results).toHaveLength(1);
      const quote = results[0];
      
      // 3천만원 * 1.4% (0.014) = 420,000원
      expect(quote.baseMonthly).toBe(420000);
      expect(quote.monthlyPayment).toBe(420000);
      expect(quote.surcharges.totalSurcharge).toBe(0);
    });
  });

  describe("보증금(Deposit) 적용 계산", () => {
    it("보증금 30% 일 때 할인이 정확히 적용되어야 한다", () => {
      const inputWithDeposit: CalcInput = { ...defaultInput, depositRate: 30 };
      const results = calculateMultiFinanceQuote(inputWithDeposit);
      const quote = results[0];

      // 보증금액: 3천만원 * 30% = 900만원
      expect(quote.breakdown.depositAmount).toBe(9000000);

      // 회수율 할인: 30% -> 3단계. -0.0005 * 3 = -0.0015
      // 최종 회수율: 0.014 - 0.0015 = 0.0125
      // 월 렌트료: 3천만원 * 0.0125 = 375,000원
      expect(quote.baseMonthly).toBe(375000);
      expect(quote.breakdown.depositDiscount).toBe(45000); // (420,000 - 375,000)
    });
  });

  describe("선납금(Prepay) 적용 계산", () => {
    it("선납금 30% 일 때 원금 차감과 추가 할인이 정확히 적용되어야 한다", () => {
      const inputWithPrepay: CalcInput = { ...defaultInput, prepayRate: 30 };
      const results = calculateMultiFinanceQuote(inputWithPrepay);
      const quote = results[0];

      // 선납금액: 3천만원 * 30% = 900만원
      expect(quote.breakdown.prepayAmount).toBe(9000000);

      // 기본 렌트료: 420,000원
      // 선납금 원금 차감액 (월): 900만원 / 48개월 = 187,500원
      // 선납금 추가 할인율 (3단계): -0.0002 * 3 = -0.0006
      // 선납금 추가 할인액: 3천만원 * 0.0006 = 18,000원
      // 최종 월 렌트료 = 420,000 - 187,500 - 18,000 = 214,500원
      expect(quote.baseMonthly).toBe(214500);
    });
  });

  describe("가산율(Surcharge) 적용 계산", () => {
    it("차량 가산율과 순위 가산율이 누적되어 정확히 더해져야 한다", () => {
      const inputWithSurcharge: CalcInput = {
        ...defaultInput,
        vehicleSurchargeRate: 5, // 차량 가산율 5%
        rankSurchargeRates: [10], // 1순위 가산율 10%
      };
      
      const results = calculateMultiFinanceQuote(inputWithSurcharge);
      const quote = results[0];

      // 기본 렌트료: 420,000원
      // 순위 가산(10%): 42,000원 -> 누적 462,000원
      // 차량 가산(5%): 462,000 * 0.05 = 23,100원 -> 누적 485,100원
      
      expect(quote.surcharges.rankSurcharge).toBe(42000);
      expect(quote.surcharges.vehicleSurcharge).toBe(23100);
      expect(quote.monthlyPayment).toBe(485100);
    });
  });

  describe("엣지 케이스 (예외 처리)", () => {
    it("회수율 매트릭스에 매칭되는 데이터가 없으면 계산에서 제외해야 한다", () => {
      const inputWithInvalidMonths: CalcInput = {
        ...defaultInput,
        contractMonths: 12, // 12개월은 매트릭스에 없음
      };
      
      const results = calculateMultiFinanceQuote(inputWithInvalidMonths);
      
      // 유효한 회수율이 없으므로 결과 배열은 비어있어야 함
      expect(results).toHaveLength(0);
    });
  });
});
