import { describe, it, expect } from "vitest";
import {
  gateQuoteScenariosForGuest,
  isPublicQuoteResultRates,
  lockQuoteScenario,
  lockRecommendScenario,
} from "./member-gate";
import type { QuoteScenarioDetail } from "@/types/quote";
import type { RecommendScenario } from "@/types/recommendation";

describe("member-gate", () => {
  const quoteBase: QuoteScenarioDetail = {
    monthlyPayment: 561_680,
    depositAmount: 8_768_000,
    prepayAmount: 0,
    contractMonths: 36,
    annualMileage: 20000,
    contractType: "반납형",
    bestFinanceCompany: "오릭스 캐피탈",
    purchaseSurcharge: 0,
    breakdown: {
      vehiclePrice: 43_840_000,
      baseMonthly: 600_000,
      depositDiscount: 4_588,
      prepayAdjust: 0,
      monthlyBeforeSurcharge: 595_412,
    } as QuoteScenarioDetail["breakdown"],
    surcharges: { totalSurcharge: 12_345 } as QuoteScenarioDetail["surcharges"],
    allFinanceResults: [
      { financeCompanyName: "오릭스 캐피탈", monthlyPayment: 561_680, rank: 0 },
    ] as QuoteScenarioDetail["allFinanceResults"],
    rangeExceeded: false,
  };

  const recommendBase: RecommendScenario = {
    monthlyPayment: 421_750,
    depositAmount: 0,
    prepayAmount: 13_152_000,
    contractMonths: 48,
    annualMileage: 10000,
    contractType: "인수형",
  };

  describe("lockQuoteScenario", () => {
    it("민감한 금액·산출내역을 전부 제거하고 월납입금은 null(가격 없음)로 둔다", () => {
      const locked = lockQuoteScenario(quoteBase);
      // 잠금 = "가격 없음"이다. 0원이라는 가짜 가격을 만들면 안 된다.
      expect(locked.monthlyPayment).toBeNull();
      expect(locked.depositAmount).toBe(0);
      expect(locked.prepayAmount).toBe(0);
      expect(locked.bestFinanceCompany).toBe("");
      expect(locked.purchaseSurcharge).toBe(0);
      expect(locked.breakdown).toBeNull();
      expect(locked.surcharges).toBeNull();
      expect(locked.allFinanceResults).toEqual([]);
      expect(locked.locked).toBe(true);
    });

    it("잠금 시나리오는 숫자 0을 월납입금 센티널로 쓰지 않는다", () => {
      const locked = lockQuoteScenario(quoteBase);
      expect(locked.monthlyPayment).not.toBe(0);
      expect(JSON.stringify(locked)).toContain('"monthlyPayment":null');
    });

    it("레이아웃용 비민감 필드(계약기간/약정거리/계약유형)는 유지한다", () => {
      const locked = lockQuoteScenario(quoteBase);
      expect(locked.contractMonths).toBe(36);
      expect(locked.annualMileage).toBe(20000);
      expect(locked.contractType).toBe("반납형");
    });

    it("원본 객체를 변형하지 않는다 (immutable)", () => {
      const snapshot = JSON.parse(JSON.stringify(quoteBase));
      lockQuoteScenario(quoteBase);
      expect(quoteBase).toEqual(snapshot);
    });

    it("잠금 결과 JSON 어디에도 원래 월납입금이 새지 않는다", () => {
      const serialized = JSON.stringify(lockQuoteScenario(quoteBase));
      expect(serialized).not.toContain("561680");
      expect(serialized).not.toContain("8768000");
    });
  });

  describe("lockRecommendScenario", () => {
    it("민감한 금액을 전부 0으로 제거하고 locked 를 세운다", () => {
      const locked = lockRecommendScenario(recommendBase);
      expect(locked.monthlyPayment).toBe(0);
      expect(locked.depositAmount).toBe(0);
      expect(locked.prepayAmount).toBe(0);
      expect(locked.locked).toBe(true);
    });

    it("레이아웃용 비민감 필드는 유지한다", () => {
      const locked = lockRecommendScenario(recommendBase);
      expect(locked.contractMonths).toBe(48);
      expect(locked.annualMileage).toBe(10000);
      expect(locked.contractType).toBe("인수형");
    });

    it("원본을 변형하지 않고, 원래 선납금/월납입금이 새지 않는다", () => {
      const snapshot = JSON.parse(JSON.stringify(recommendBase));
      const serialized = JSON.stringify(lockRecommendScenario(recommendBase));
      expect(recommendBase).toEqual(snapshot);
      expect(serialized).not.toContain("421750");
      expect(serialized).not.toContain("13152000");
    });
  });

  describe("isPublicQuoteResultRates", () => {
    it("선납 30% · 무보증만 공개 조건으로 본다", () => {
      expect(isPublicQuoteResultRates({ depositRate: 0, prepayRate: 30 })).toBe(true);
      expect(isPublicQuoteResultRates({ depositRate: 0, prepayRate: 0 })).toBe(false);
      expect(isPublicQuoteResultRates({ depositRate: 10, prepayRate: 0 })).toBe(false);
      expect(isPublicQuoteResultRates({ depositRate: 0, prepayRate: 20 })).toBe(false);
    });
  });

  describe("gateQuoteScenariosForGuest", () => {
    const scenarios = {
      conservative: { ...quoteBase, monthlyPayment: 610_000 },
      standard: { ...quoteBase, monthlyPayment: 700_000, depositAmount: 0 },
      aggressive: {
        ...quoteBase,
        monthlyPayment: 530_000,
        depositAmount: 0,
        prepayAmount: 12_000_000,
      },
    };

    it("선납 30%는 실제 금액을 남기고 무보증·보증금은 가격 없이 잠근다", () => {
      const gated = gateQuoteScenariosForGuest(scenarios);
      expect(gated.aggressive.monthlyPayment).toBe(530_000);
      expect(gated.aggressive.locked).not.toBe(true);
      expect(gated.standard).toMatchObject({ monthlyPayment: null, locked: true });
      expect(gated.conservative).toMatchObject({ monthlyPayment: null, locked: true });
    });

    it("공개 조건 커스텀 재계산이면 standard 슬롯 금액을 유지한다", () => {
      const gated = gateQuoteScenariosForGuest(scenarios, { keepStandardUnlocked: true });
      expect(gated.standard.monthlyPayment).toBe(700_000);
      expect(gated.standard.locked).not.toBe(true);
      expect(gated.conservative.locked).toBe(true);
    });
  });
});
