import type { PDFQuoteColor, PDFQuoteData } from "@/lib/quote-pdf-template";
import {
  buildVehicleScenarios,
  type ContractTypeKor,
  type SelectedOptionSnapshot,
} from "@/lib/quote-scenarios";
import {
  deriveQuoteScenarioType,
  parseQuoteScenarioType,
  realignSelectedQuoteScenarios,
} from "@/lib/quote-scenario-selection";
import type { QuoteScenarioDetail } from "@/types/quote";

export interface OfficialDeliveryQuote {
  id: string;
  vehicleId: string;
  trimId: string;
  contractMonths: number;
  annualMileage: number;
  depositRate: number;
  prepayRate: number;
  contractType: string;
  monthlyPayment: number;
  pricingStatus: string;
  breakdown: unknown;
  exteriorColorId: string | null;
  interiorColorId: string | null;
}

export type OfficialDeliveryImageResult =
  | { ok: true; data: PDFQuoteData }
  | { ok: false; error: { status: number; error: string } };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function storedString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function storedMoney(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function contractType(value: string): ContractTypeKor {
  return value === "인수형" ? "인수형" : "반납형";
}

function productType(value: unknown): "장기렌트" | "리스" {
  return value === "리스" ? "리스" : "장기렌트";
}

function selectedOptions(value: unknown): SelectedOptionSnapshot[] {
  if (!Array.isArray(value)) return [];
  const options: SelectedOptionSnapshot[] = [];
  for (const item of value) {
    const option = asRecord(item);
    if (
      typeof option.id === "string" &&
      typeof option.name === "string" &&
      typeof option.price === "number" &&
      Number.isFinite(option.price) &&
      option.price >= 0
    ) {
      options.push({ id: option.id, name: option.name, price: option.price });
    }
  }
  return options;
}

function color(value: unknown): PDFQuoteColor | null {
  const source = asRecord(value);
  if (
    typeof source.name !== "string" ||
    typeof source.hexCode !== "string" ||
    typeof source.priceDelta !== "number" ||
    !Number.isFinite(source.priceDelta)
  ) {
    return null;
  }
  return {
    name: source.name,
    hexCode: source.hexCode,
    priceDelta: source.priceDelta,
  };
}

export async function buildOfficialDeliveryImageData(
  quote: OfficialDeliveryQuote
): Promise<OfficialDeliveryImageResult> {
  if (quote.pricingStatus !== "CALCULATED") {
    return {
      ok: false,
      error: { status: 409, error: "자동 산출된 견적만 카카오톡으로 전송할 수 있습니다." },
    };
  }

  const breakdown = asRecord(quote.breakdown);
  const savedOptions = selectedOptions(breakdown.selectedOptions);
  const selectedOptionIds = savedOptions.length > 0
    ? savedOptions.map((option) => option.id)
    : Array.isArray(breakdown.selectedOptionIds)
      ? breakdown.selectedOptionIds.filter((id): id is string => typeof id === "string")
      : [];
  const savedProductType = productType(breakdown.productType);
  const savedContractType = contractType(quote.contractType);
  const selectedScenarioType =
    parseQuoteScenarioType(breakdown.scenarioType) ??
    deriveQuoteScenarioType({ depositRate: quote.depositRate, prepayRate: quote.prepayRate });

  const rebuilt = await buildVehicleScenarios({
    vehicleSlugOrId: quote.vehicleId,
    trimId: quote.trimId,
    selectedOptionIds,
    contractMonths: quote.contractMonths,
    annualMileage: quote.annualMileage,
    contractType: savedContractType,
    exteriorColorId: quote.exteriorColorId,
    interiorColorId: quote.interiorColorId,
    productType: savedProductType,
  });
  if (!rebuilt.ok) {
    return {
      ok: false,
      error: { status: 409, error: "저장된 견적을 현재 공식 견적서로 재구성할 수 없습니다." },
    };
  }

  const totalVehiclePrice = storedMoney(breakdown.totalVehiclePrice, rebuilt.data.totalVehiclePrice);
  const savedQuoteBreakdown = asRecord(breakdown.quoteBreakdown);
  const calculatedDeposit = Math.round(totalVehiclePrice * quote.depositRate / 100);
  const calculatedPrepay = Math.round(totalVehiclePrice * quote.prepayRate / 100);
  const fallbackScenario = rebuilt.data.scenarios[selectedScenarioType];
  const selectedScenario: QuoteScenarioDetail = {
    ...fallbackScenario,
    monthlyPayment: quote.monthlyPayment,
    depositAmount: storedMoney(savedQuoteBreakdown.depositAmount, calculatedDeposit),
    prepayAmount: storedMoney(savedQuoteBreakdown.prepayAmount, calculatedPrepay),
    contractMonths: quote.contractMonths,
    annualMileage: quote.annualMileage,
    contractType: savedContractType,
    bestFinanceCompany: storedString(breakdown.bestFinanceCompany, fallbackScenario.bestFinanceCompany),
    purchaseSurcharge: storedMoney(breakdown.purchaseSurcharge, fallbackScenario.purchaseSurcharge),
  };

  const scenariosWithSavedSelection = {
    ...rebuilt.data.scenarios,
    standard: selectedScenario,
  };
  const scenarios = selectedScenarioType === "standard"
    ? scenariosWithSavedSelection
    : realignSelectedQuoteScenarios(
        scenariosWithSavedSelection,
        selectedScenarioType,
        rebuilt.data.scenarios.standard
      );

  const exteriorColor = color(breakdown.exteriorColor) ?? rebuilt.data.exteriorColor;
  const interiorColor = color(breakdown.interiorColor) ?? rebuilt.data.interiorColor;

  return {
    ok: true,
    data: {
      vehicleName: storedString(breakdown.vehicleName, rebuilt.data.vehicleName),
      vehicleBrand: storedString(breakdown.vehicleBrand, rebuilt.data.vehicleBrand),
      trimName: storedString(breakdown.trimName, rebuilt.data.trimName),
      trimPrice: storedMoney(breakdown.trimPrice, rebuilt.data.trimPrice),
      selectedOptions: (savedOptions.length > 0 ? savedOptions : rebuilt.data.selectedOptions)
        .map((option) => ({ name: option.name, price: option.price })),
      totalVehiclePrice,
      productType: savedProductType,
      contractMonths: quote.contractMonths,
      annualMileage: quote.annualMileage,
      contractType: savedContractType,
      scenarioType: selectedScenarioType,
      scenarios,
      userEmail: null,
      exteriorColor,
      interiorColor,
    },
  };
}
