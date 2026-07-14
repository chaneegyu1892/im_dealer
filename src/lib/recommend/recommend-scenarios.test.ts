import { describe, expect, it } from "vitest";
import { calculateMultiFinanceQuote, type RateConfigData } from "@/lib/quote-calculator";
import { calcRepresentativeQuotes, type RepRateSheet } from "@/lib/representative-quote";
import { buildRecommendScenarios } from "./recommend-scenarios";

function matrix(value: number) {
  return {
    "36_10000": value, "36_20000": value, "36_30000": value,
    "48_10000": value, "48_20000": value, "48_30000": value,
    "60_10000": value, "60_20000": value, "60_30000": value,
  };
}

const rateConfig: RateConfigData = {
  financeCompanyId: "finance-1",
  financeCompanyName: "테스트캐피탈",
  financeSurchargeRate: 0.25,
  minVehiclePrice: 30_000_000,
  maxVehiclePrice: 50_000_000,
  minRateMatrix: matrix(0.02),
  maxRateMatrix: matrix(0.021),
  depositDiscountRate: -0.000523,
  prepayAdjustRate: 0.000073,
};

const rankSurchargeRates = [1, 1.5, 2, 2.5];
const vehiclePrice = 40_000_000;
const vehicleSurchargeRate = 0.4;

describe("buildRecommendScenarios quote parity", () => {
  it("matches the public card and regular quote calculator for the same contract", () => {
    const scenarios = buildRecommendScenarios({
      vehiclePrice,
      vehicleSurchargeRate,
      rankSurchargeRates,
      rateConfigs: [rateConfig],
      estimatedMonthly: 0,
    });
    const sheet: RepRateSheet = {
      productType: "장기렌트",
      financeCompanyId: rateConfig.financeCompanyId,
      financeCompanyName: rateConfig.financeCompanyName,
      financeSurchargeRate: rateConfig.financeSurchargeRate,
      minVehiclePrice: rateConfig.minVehiclePrice,
      maxVehiclePrice: rateConfig.maxVehiclePrice,
      minRateMatrix: rateConfig.minRateMatrix,
      maxRateMatrix: rateConfig.maxRateMatrix,
      depositDiscountRate: rateConfig.depositDiscountRate,
      prepayAdjustRate: rateConfig.prepayAdjustRate,
    };
    const [cardQuote] = calcRepresentativeQuotes({
      vehiclePrice,
      vehicleSurchargeRate,
      rankSurchargeRates,
      rateSheets: [sheet],
    });
    const [depositQuote] = calculateMultiFinanceQuote({
      vehiclePrice,
      contractMonths: 60,
      annualMileage: 20_000,
      depositRate: 20,
      prepayRate: 0,
      vehicleSurchargeRate,
      rankSurchargeRates,
      rateConfigs: [rateConfig],
    });
    const [prepayQuote] = calculateMultiFinanceQuote({
      vehiclePrice,
      contractMonths: 60,
      annualMileage: 20_000,
      depositRate: 0,
      prepayRate: 30,
      vehicleSurchargeRate,
      rankSurchargeRates,
      rateConfigs: [rateConfig],
    });

    expect(scenarios.standard.monthlyPayment).toBe(cardQuote?.monthlyPayment);
    expect(scenarios.conservative).toMatchObject({
      monthlyPayment: depositQuote?.monthlyPayment,
      depositAmount: depositQuote?.breakdown.depositAmount,
      contractMonths: 60,
      annualMileage: 20_000,
    });
    expect(scenarios.aggressive).toMatchObject({
      monthlyPayment: prepayQuote?.monthlyPayment,
      prepayAmount: prepayQuote?.breakdown.prepayAmount,
      contractMonths: 60,
      annualMileage: 20_000,
    });
  });
});
