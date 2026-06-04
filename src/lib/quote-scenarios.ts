import { prisma } from "@/lib/prisma";
import {
  calculateMultiFinanceQuote,
  type CalcInput,
  type RateConfigData,
} from "@/lib/quote-calculator";
import type { FinanceQuoteResult, QuoteScenarioDetails } from "@/types/quote";
import type { RateSheetRaw } from "@/types/admin";
import { RANK_SURCHARGE_RATES } from "@/constants/quote-defaults";

const SCENARIO_CONDITIONS = {
  conservative: { depositRate: 20, prepayRate: 0 },
  standard: { depositRate: 0, prepayRate: 0 },
  aggressive: { depositRate: 0, prepayRate: 30 },
} as const;

export type ContractTypeKor = "인수형" | "반납형";

export interface BuildVehicleScenariosInput {
  /** 차량 식별자 — slug 우선, 없으면 id 로 조회 */
  vehicleSlugOrId: string;
  /** 트림 id. 미지정 시 isDefault → 첫 번째 트림 */
  trimId?: string;
  /** 선택된 옵션 id 배열. 없으면 빈 배열로 처리 */
  selectedOptionIds?: string[];
  /** 추가 옵션 가격 (선택 옵션 외 별도 합산 — 레거시 호환용) */
  extraOptionsPrice?: number;
  contractMonths: number;
  annualMileage: number;
  contractType: ContractTypeKor;
  /** 외장 색상 id (있으면 priceDelta 가 totalVehiclePrice 에 합산됨) */
  exteriorColorId?: string | null;
  /** 내장 색상 id */
  interiorColorId?: string | null;
}

export interface VehicleColorSnapshot {
  id: string;
  name: string;
  hexCode: string;
  priceDelta: number;
}

export interface SelectedOptionSnapshot {
  id: string;
  name: string;
  price: number;
}

export interface BuildVehicleScenariosResult {
  vehicleId: string;
  vehicleSlug: string;
  vehicleName: string;
  vehicleBrand: string;
  trimId: string;
  trimName: string;
  trimPrice: number;
  optionsTotalPrice: number;
  colorDelta: number;
  totalVehiclePrice: number;
  selectedOptions: SelectedOptionSnapshot[];
  exteriorColor: VehicleColorSnapshot | null;
  interiorColor: VehicleColorSnapshot | null;
  scenarios: QuoteScenarioDetails;
}

export interface BuildVehicleScenariosError {
  error: string;
  status: number;
}

export type BuildVehicleScenariosOutcome =
  | { ok: true; data: BuildVehicleScenariosResult }
  | { ok: false; error: BuildVehicleScenariosError };

/**
 * 차량/트림/옵션/계약조건을 받아 표준 3개 시나리오(무보증/보증금/선납금)를 계산해 반환.
 * `/api/quote/calculate`와 어드민 PDF 재다운로드 라우트가 공유한다.
 */
export async function buildVehicleScenarios(
  input: BuildVehicleScenariosInput
): Promise<BuildVehicleScenariosOutcome> {
  // 1) 차량 + 트림 + 옵션 조회 (slug 우선, 없으면 id)
  let vehicle = await prisma.vehicle.findUnique({
    where: { slug: input.vehicleSlugOrId },
    include: {
      trims: {
        where: { isVisible: true },
        orderBy: { isDefault: "desc" },
        include: { options: { select: { id: true, name: true, price: true } } },
      },
      colors: {
        select: { id: true, kind: true, name: true, hexCode: true, priceDelta: true },
      },
    },
  });

  if (!vehicle) {
    vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleSlugOrId },
      include: {
        trims: {
          where: { isVisible: true },
          orderBy: { isDefault: "desc" },
          include: { options: { select: { id: true, name: true, price: true } } },
        },
        colors: {
          select: { id: true, kind: true, name: true, hexCode: true, priceDelta: true },
        },
      },
    });
  }

  if (!vehicle || !vehicle.isVisible) {
    return { ok: false, error: { error: "차량을 찾을 수 없습니다.", status: 404 } };
  }

  const trim = input.trimId
    ? vehicle.trims.find((t) => t.id === input.trimId)
    : vehicle.trims.find((t) => t.isDefault) ?? vehicle.trims[0];

  if (!trim) {
    return { ok: false, error: { error: "트림을 찾을 수 없습니다.", status: 404 } };
  }

  const selectedOptionIds = new Set(input.selectedOptionIds ?? []);
  const selectedOptions: SelectedOptionSnapshot[] = trim.options
    .filter((o) => selectedOptionIds.has(o.id))
    .map((o) => ({ id: o.id, name: o.name, price: o.price }));
  const trimOptionsTotalPrice = selectedOptions.reduce((sum, o) => sum + o.price, 0);
  const optionsTotalPrice = trimOptionsTotalPrice + (input.extraOptionsPrice ?? 0);

  // 색상 priceDelta — vehicle 소속 + kind 일치 검증
  const exteriorColorRow = input.exteriorColorId
    ? vehicle.colors.find((c) => c.id === input.exteriorColorId && c.kind === "EXTERIOR") ?? null
    : null;
  const interiorColorRow = input.interiorColorId
    ? vehicle.colors.find((c) => c.id === input.interiorColorId && c.kind === "INTERIOR") ?? null
    : null;
  const exteriorColor: VehicleColorSnapshot | null = exteriorColorRow
    ? {
        id: exteriorColorRow.id,
        name: exteriorColorRow.name,
        hexCode: exteriorColorRow.hexCode,
        priceDelta: exteriorColorRow.priceDelta,
      }
    : null;
  const interiorColor: VehicleColorSnapshot | null = interiorColorRow
    ? {
        id: interiorColorRow.id,
        name: interiorColorRow.name,
        hexCode: interiorColorRow.hexCode,
        priceDelta: interiorColorRow.priceDelta,
      }
    : null;
  const colorDelta = (exteriorColor?.priceDelta ?? 0) + (interiorColor?.priceDelta ?? 0);

  // 2) 회수율 데이터 + 순위 가산 동시 조회
  const [rateSheets, rankSurcharges] = await Promise.all([
    prisma.capitalRateSheet.findMany({
      where: { trimId: trim.id, isActive: true, financeCompany: { isActive: true } },
      include: { financeCompany: true },
    }),
    prisma.rankSurchargeConfig.findMany({ orderBy: { rank: "asc" } }),
  ]);

  if (rateSheets.length === 0) {
    return {
      ok: false,
      error: { error: "이 차량의 견적 데이터가 아직 준비되지 않았습니다.", status: 404 },
    };
  }

  const configs: RateConfigData[] = rateSheets.map((rs) => ({
    financeCompanyId: rs.financeCompanyId,
    financeCompanyName: rs.financeCompany.name,
    financeSurchargeRate: rs.financeCompany.surchargeRate,
    minVehiclePrice: rs.minVehiclePrice,
    maxVehiclePrice: rs.maxVehiclePrice,
    minRateMatrix: rs.minRateMatrix as RateSheetRaw,
    maxRateMatrix: rs.maxRateMatrix as RateSheetRaw,
    depositDiscountRate: rs.depositDiscountRate,
    prepayAdjustRate: rs.prepayAdjustRate,
  }));

  const rankRates =
    rankSurcharges.length > 0 ? rankSurcharges.map((r) => r.rate) : [...RANK_SURCHARGE_RATES];

  // 3) 3개 시나리오 계산
  const scenarioKeys = ["conservative", "standard", "aggressive"] as const;
  const scenarios = {} as Record<(typeof scenarioKeys)[number], QuoteScenarioDetails["conservative"]>;

  for (const key of scenarioKeys) {
    const { depositRate, prepayRate } = SCENARIO_CONDITIONS[key];

    const calcInput: CalcInput = {
      vehiclePrice: trim.price + optionsTotalPrice + colorDelta,
      contractMonths: input.contractMonths,
      annualMileage: input.annualMileage,
      depositRate,
      prepayRate,
      vehicleSurchargeRate: vehicle.surchargeRate,
      rankSurchargeRates: rankRates,
      rateConfigs: configs,
    };

    const results = calculateMultiFinanceQuote(calcInput);

    if (results.length === 0) {
      scenarios[key] = {
        monthlyPayment: 0,
        depositAmount: 0,
        prepayAmount: 0,
        contractMonths: input.contractMonths,
        annualMileage: input.annualMileage,
        contractType: input.contractType,
        bestFinanceCompany: "",
        purchaseSurcharge: 0,
        breakdown: null,
        surcharges: null,
        allFinanceResults: [],
      };
      continue;
    }

    const isPurchase = input.contractType === "인수형";
    const best: FinanceQuoteResult = results[0];
    const purchaseSurcharge = isPurchase ? Math.round(best.monthlyPayment * 0.12) : 0;
    const monthlyPayment = best.monthlyPayment + purchaseSurcharge;

    scenarios[key] = {
      monthlyPayment,
      depositAmount: best.breakdown.depositAmount,
      prepayAmount: best.breakdown.prepayAmount,
      contractMonths: input.contractMonths,
      annualMileage: input.annualMileage,
      contractType: input.contractType,
      bestFinanceCompany: best.financeCompanyName,
      purchaseSurcharge,
      breakdown: best.breakdown,
      surcharges: best.surcharges,
      allFinanceResults: results.map((r) => {
        const rPurchase = isPurchase ? Math.round(r.monthlyPayment * 0.12) : 0;
        return {
          financeCompanyName: r.financeCompanyName,
          rank: r.rank,
          monthlyPayment: r.monthlyPayment + rPurchase,
          baseMonthly: r.baseMonthly,
          surcharges: r.surcharges,
        };
      }),
    };
  }

  return {
    ok: true,
    data: {
      vehicleId: vehicle.id,
      vehicleSlug: vehicle.slug,
      vehicleName: vehicle.name,
      vehicleBrand: vehicle.brand,
      trimId: trim.id,
      trimName: trim.name,
      trimPrice: trim.price,
      optionsTotalPrice,
      colorDelta,
      totalVehiclePrice: trim.price + optionsTotalPrice + colorDelta,
      selectedOptions,
      exteriorColor,
      interiorColor,
      scenarios: scenarios as QuoteScenarioDetails,
    },
  };
}
