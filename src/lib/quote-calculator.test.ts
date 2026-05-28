import { describe, it, expect } from "vitest";
import {
  calculateMultiFinanceQuote,
  calcDepositDiscountRate,
  calcPrepayAdjustRate,
  getRateFromMatrix,
  type RateConfigData,
  type CalcInput,
} from "./quote-calculator";
import type { RateSheetRaw } from "@/types/admin";

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
    depositDiscountRate: -0.0005, // 보증금 10%당 0.05% 할인 (음수 전용)
    prepayAdjustRate: -0.0002,    // 선납금 10%당 0.02% 할인 (음수=할인, 양수=가산)
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
      // 선납금 조정율 (3단계): -0.0002 * 3 = -0.0006 (음수 = 할인)
      // 선납금 조정액: 3천만원 * (-0.0006) = -18,000원
      // 최종 월 렌트료 = 420,000 - 187,500 + (-18,000) = 214,500원
      expect(quote.baseMonthly).toBe(214500);
    });

    it("prepayAdjustRate 가 양수면 가산으로 동작해야 한다", () => {
      const inputWithSurchargePrepay: CalcInput = {
        ...defaultInput,
        prepayRate: 30,
        rateConfigs: [{ ...mockRateConfig, prepayAdjustRate: 0.0002 }],
      };
      const results = calculateMultiFinanceQuote(inputWithSurchargePrepay);
      const quote = results[0];

      // 선납금 조정율: +0.0002 * 3 = +0.0006 (양수 = 가산)
      // 선납금 조정액: 3천만원 * 0.0006 = +18,000원
      // 최종 = 420,000 - 187,500 + 18,000 = 250,500원
      expect(quote.baseMonthly).toBe(250500);
    });
  });

  describe("가산율(Surcharge) 적용 계산 — 차량가 기준 합산", () => {
    it("순위·차량 가산은 (차량가 × 가산율 ÷ 개월수) 로 합산되어야 한다", () => {
      const inputWithSurcharge: CalcInput = {
        ...defaultInput,
        vehicleSurchargeRate: 5,    // 차량 가산율 5%
        rankSurchargeRates: [10],   // 1순위 가산율 10%
      };

      const results = calculateMultiFinanceQuote(inputWithSurcharge);
      const quote = results[0];

      // 기본 렌트료: 420,000원
      // 순위 가산: 30,000,000 × 10% / 48개월 = 3,000,000 / 48 = 62,500원
      // 차량 가산: 30,000,000 × 5% / 48개월  = 1,500,000 / 48 = 31,250원
      // 금융사 가산: 0
      // 최종 월 렌트료 = 420,000 + 62,500 + 31,250 = 513,750원
      expect(quote.surcharges.rankSurcharge).toBe(62500);
      expect(quote.surcharges.vehicleSurcharge).toBe(31250);
      expect(quote.surcharges.financeSurcharge).toBe(0);
      expect(quote.monthlyPayment).toBe(513750);
    });

    it("고객 명세 예시: 차량가 5천만 × 1% / 48개월 → 월 10,417원 가산", () => {
      // 명세 예시는 단일 1% 가산. 차량 가산율 1% 로 모사.
      const config: RateConfigData = {
        ...mockRateConfig,
        minVehiclePrice: 50_000_000,
        maxVehiclePrice: 50_000_000,
        minRateMatrix: { ...mockRateConfig.minRateMatrix, "48_20000": 0.01 },
        maxRateMatrix: { ...mockRateConfig.maxRateMatrix, "48_20000": 0.01 },
      };
      const input: CalcInput = {
        ...defaultInput,
        vehiclePrice: 50_000_000,
        contractMonths: 48,
        annualMileage: 20000,
        vehicleSurchargeRate: 1,
        rankSurchargeRates: [0],
        rateConfigs: [config],
      };

      const results = calculateMultiFinanceQuote(input);
      const quote = results[0];

      // 기본: 50,000,000 × 1% = 500,000원
      // 차량 가산: 50,000,000 × 1% / 48 = 500,000 / 48 ≒ 10,416.67원
      // 최종: 500,000 + 10,416.67 → round → 510,417원
      expect(quote.baseMonthly).toBe(500000);
      expect(quote.monthlyPayment).toBe(510417);
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

  // ─── 어드민 자동 산출 헬퍼 검증 ───────────────────────────
  describe("calcDepositDiscountRate 부호 컨벤션", () => {
    const VEHICLE_PRICE = 50_000_000;

    function makeSheet(rate: number): RateSheetRaw {
      // 9개 키 모두 같은 월 지불액으로 채움 (헬퍼 평균 산출 검증용)
      const months = VEHICLE_PRICE * rate;
      return {
        "36_10000": months, "36_20000": months, "36_30000": months,
        "48_10000": months, "48_20000": months, "48_30000": months,
        "60_10000": months, "60_20000": months, "60_30000": months,
      };
    }

    it("dep < base (할인 정상 입력) 시 음수를 반환해야 한다", () => {
      const base = makeSheet(0.012506);
      // 보증금 적용 시 회수율 -0.0005 만큼 할인된 값으로 입력했다고 가정
      const dep = makeSheet(0.012506 - 0.0005);

      const result = calcDepositDiscountRate(base, dep, VEHICLE_PRICE);
      expect(result).toBeLessThan(0);
      // -0.0005 근사
      expect(result).toBeCloseTo(-0.0005, 4);
    });

    it("dep > base (잘못된 가산 입력) 시 양수를 반환해야 한다 (API가 차단)", () => {
      const base = makeSheet(0.012506);
      const dep = makeSheet(0.012506 + 0.0003);

      const result = calcDepositDiscountRate(base, dep, VEHICLE_PRICE);
      expect(result).toBeGreaterThan(0);
    });

    it("입력 시트가 비어 있으면 0 반환", () => {
      const empty: RateSheetRaw = {
        "36_10000": 0, "36_20000": 0, "36_30000": 0,
        "48_10000": 0, "48_20000": 0, "48_30000": 0,
        "60_10000": 0, "60_20000": 0, "60_30000": 0,
      };
      expect(calcDepositDiscountRate(empty, empty, VEHICLE_PRICE)).toBe(0);
    });

    it("calculator 와 일관 동작: 음수 반환값을 calculator 에 넣으면 할인 적용", () => {
      const base = makeSheet(0.012506);
      const dep = makeSheet(0.012506 - 0.0005);
      const discountRate = calcDepositDiscountRate(base, dep, VEHICLE_PRICE);
      expect(discountRate).toBeLessThan(0);

      // 헬퍼 산출값을 calculator 에 그대로 주입해 할인이 적용되는지 검증
      const config: RateConfigData = {
        ...mockRateConfig,
        minVehiclePrice: VEHICLE_PRICE,
        maxVehiclePrice: VEHICLE_PRICE,
        minRateMatrix: { ...mockRateConfig.minRateMatrix, "48_20000": 0.012506 },
        maxRateMatrix: { ...mockRateConfig.maxRateMatrix, "48_20000": 0.012506 },
        depositDiscountRate: discountRate,
      };
      const withDeposit = calculateMultiFinanceQuote({
        ...defaultInput,
        vehiclePrice: VEHICLE_PRICE,
        depositRate: 10,
        rateConfigs: [config],
      })[0];
      const noDeposit = calculateMultiFinanceQuote({
        ...defaultInput,
        vehiclePrice: VEHICLE_PRICE,
        depositRate: 0,
        rateConfigs: [config],
      })[0];

      expect(withDeposit.baseMonthly).toBeLessThan(noDeposit.baseMonthly);
    });
  });

  describe("calcPrepayAdjustRate 부호 컨벤션", () => {
    const VEHICLE_PRICE = 50_000_000;

    function makeSheet(monthly: number): RateSheetRaw {
      return {
        "36_10000": monthly, "36_20000": monthly, "36_30000": monthly,
        "48_10000": monthly, "48_20000": monthly, "48_30000": monthly,
        "60_10000": monthly, "60_20000": monthly, "60_30000": monthly,
      };
    }

    it("선납금 적용 시 base 보다 낮으면 (할인) 음수 반환", () => {
      const base = makeSheet(VEHICLE_PRICE * 0.012506);
      // prepay 시 base - prepayDeduction - extra(할인)
      // 36개월 prepayDeduction = 50M * 0.1 / 36 = 138,888.89
      // 정확한 음수 산출 확인용
      const prepay: RateSheetRaw = {} as RateSheetRaw;
      for (const k of Object.keys(base)) {
        const [m] = k.split("_");
        const months = Number(m);
        const deduction = (VEHICLE_PRICE * 0.1) / months;
        prepay[k as keyof RateSheetRaw] = (base[k as keyof RateSheetRaw] ?? 0) - deduction - 3000;
      }
      const result = calcPrepayAdjustRate(base, prepay, VEHICLE_PRICE);
      expect(result).toBeLessThan(0);
    });

    it("선납금 적용 시 base 보다 높으면 (가산) 양수 반환", () => {
      const base = makeSheet(VEHICLE_PRICE * 0.012506);
      const prepay: RateSheetRaw = {} as RateSheetRaw;
      for (const k of Object.keys(base)) {
        const [m] = k.split("_");
        const months = Number(m);
        const deduction = (VEHICLE_PRICE * 0.1) / months;
        // base - deduction + 가산 → prepay 가 base - deduction 보다 큼
        prepay[k as keyof RateSheetRaw] = (base[k as keyof RateSheetRaw] ?? 0) - deduction + 3000;
      }
      const result = calcPrepayAdjustRate(base, prepay, VEHICLE_PRICE);
      expect(result).toBeGreaterThan(0);
    });
  });
});
