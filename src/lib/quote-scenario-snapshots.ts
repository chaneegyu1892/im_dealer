// 견적 저장 시점의 3개 표준 시나리오(보증금/무보증/선납금) 금액을 스냅샷으로 남긴다.
// 이후 요율 시트나 차량가가 바뀌어도, 재발급 견적서의 시나리오 비교 표가
// 고객이 실제 받았던 값 그대로 재현되도록 하는 것이 목적이다.
import {
  calculateMultiFinanceQuote,
  type CalcInput,
  type RateConfigData,
} from "@/lib/quote-calculator";
import { SCENARIO_CONDITIONS } from "@/constants/quote-defaults";

export type ScenarioSnapshotType = keyof typeof SCENARIO_CONDITIONS;

/** 저장 시점에 고정하는 필드는 이 다섯 개뿐이다.
 * 시나리오의 나머지 중첩 필드(breakdown·surcharges·allFinanceResults 등)는
 * 스냅샷 계약에 포함되지 않으며, 재발급 시 현재 요율로 재계산된 값이 남는다. */
export interface ScenarioSnapshot {
  monthlyPayment: number;
  depositAmount: number;
  prepayAmount: number;
  bestFinanceCompany: string;
  purchaseSurcharge: number;
}

/** 시나리오별 스냅샷 — 금융사가 견적 불가한 시나리오는 null. */
export type ScenarioSnapshots = Record<ScenarioSnapshotType, ScenarioSnapshot | null>;

export interface BuildScenarioSnapshotsInput {
  vehiclePrice: number;
  contractMonths: number;
  annualMileage: number;
  vehicleSurchargeRate: number;
  rankSurchargeRates: number[];
  rateConfigs: RateConfigData[];
  contractType: "인수형" | "반납형";
}

export function buildScenarioSnapshots(
  input: BuildScenarioSnapshotsInput
): ScenarioSnapshots {
  const isPurchase = input.contractType === "인수형";
  const snapshots = {} as Record<ScenarioSnapshotType, ScenarioSnapshot | null>;

  for (const key of Object.keys(SCENARIO_CONDITIONS) as ScenarioSnapshotType[]) {
    const { depositRate, prepayRate } = SCENARIO_CONDITIONS[key];
    const calcInput: CalcInput = {
      vehiclePrice: input.vehiclePrice,
      contractMonths: input.contractMonths,
      annualMileage: input.annualMileage,
      depositRate,
      prepayRate,
      vehicleSurchargeRate: input.vehicleSurchargeRate,
      rankSurchargeRates: input.rankSurchargeRates,
      rateConfigs: input.rateConfigs,
    };

    const best = calculateMultiFinanceQuote(calcInput)[0];
    if (!best) {
      snapshots[key] = null;
      continue;
    }

    const purchaseSurcharge = isPurchase ? Math.round(best.monthlyPayment * 0.12) : 0;
    snapshots[key] = {
      monthlyPayment: best.monthlyPayment + purchaseSurcharge,
      depositAmount: best.breakdown.depositAmount,
      prepayAmount: best.breakdown.prepayAmount,
      bestFinanceCompany: best.financeCompanyName,
      purchaseSurcharge,
    };
  }

  return snapshots;
}

function parseSnapshot(value: unknown): ScenarioSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const { monthlyPayment, depositAmount, prepayAmount, purchaseSurcharge, bestFinanceCompany } = source;
  const amounts = [monthlyPayment, depositAmount, prepayAmount, purchaseSurcharge];
  if (!amounts.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0)) {
    return null;
  }
  if (typeof bestFinanceCompany !== "string") return null;
  return {
    monthlyPayment: monthlyPayment as number,
    depositAmount: depositAmount as number,
    prepayAmount: prepayAmount as number,
    bestFinanceCompany,
    purchaseSurcharge: purchaseSurcharge as number,
  };
}

/**
 * breakdown JSON에 저장된 스냅샷을 검증하며 복원한다.
 * 형식이 깨진 항목은 버리고, 쓸 수 있는 항목이 하나도 없으면 null.
 */
export function parseScenarioSnapshots(
  value: unknown
): Partial<Record<ScenarioSnapshotType, ScenarioSnapshot>> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;

  const parsed: Partial<Record<ScenarioSnapshotType, ScenarioSnapshot>> = {};
  for (const key of Object.keys(SCENARIO_CONDITIONS) as ScenarioSnapshotType[]) {
    const snapshot = parseSnapshot(source[key]);
    if (snapshot) parsed[key] = snapshot;
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}
