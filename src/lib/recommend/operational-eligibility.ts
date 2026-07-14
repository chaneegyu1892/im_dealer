import { estimateMonthly, type RateConfigData } from "@/lib/quote-calculator";
import {
  DEFAULT_PUBLIC_QUOTE_PRODUCT_TYPE,
} from "@/constants/quote-defaults";
import {
  filterLatestRecommendationTrims,
  getRecommendationModelYear,
} from "./latest-model";
import { getRecommendationExclusion, type RecommendationExclusion } from "./excluded-vehicles";
import {
  parseOverlapProfile,
  type OverlapProfile,
  type OverlapProfileIssue,
} from "./overlap-profile";
import { parseRateSheetRaw } from "./rate-sheet";

export type SupportedRecommendationMileage = 10_000 | 20_000 | 30_000;

export interface OperationalRateSheet {
  readonly id: string;
  readonly productType: string;
  readonly isActive: boolean;
  readonly minVehiclePrice: number;
  readonly maxVehiclePrice: number;
  readonly minRateMatrix: unknown;
  readonly maxRateMatrix: unknown;
  readonly depositDiscountRate: number;
  readonly prepayAdjustRate: number;
  readonly financeCompany: {
    readonly id: string;
    readonly name: string;
    readonly isActive: boolean;
    readonly surchargeRate: number;
  };
}

export interface OperationalTrimSnapshot {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly discountPrice: number | null;
  readonly isDefault: boolean;
  readonly isVisible: boolean;
  readonly lineup?: { readonly name: string; readonly isVisible: boolean } | null;
  readonly rateSheets: readonly OperationalRateSheet[];
}

export interface OperationalVehicleSnapshot {
  readonly vehicleId: string;
  readonly slug: string;
  readonly brand: string;
  readonly name: string;
  readonly category: string;
  readonly isVisible: boolean;
  readonly config: { readonly isActive: boolean; readonly profile: unknown } | null;
  readonly trims: readonly OperationalTrimSnapshot[];
}

export type OperationalEligibilityStatus =
  | "excluded_vehicle_class"
  | "hidden"
  | "no_profile"
  | "inactive_profile"
  | "invalid_profile"
  | "no_visible_latest_trim"
  | "no_valid_active_rate"
  | "non_positive_quote"
  | "eligible";

type IneligibleResult =
  | { readonly status: "excluded_vehicle_class"; readonly exclusion: RecommendationExclusion }
  | { readonly status: "hidden" | "no_profile" | "inactive_profile" }
  | { readonly status: "invalid_profile"; readonly issues: readonly OverlapProfileIssue[] }
  | { readonly status: "no_visible_latest_trim" | "no_valid_active_rate" | "non_positive_quote" };

export interface EligibleOperationalResult {
  readonly status: "eligible";
  readonly profile: OverlapProfile;
  readonly selectedTrim: OperationalTrimSnapshot;
  readonly rateConfigs: readonly RateConfigData[];
  readonly estimatedMonthly: number;
  readonly modelYear: number;
}

export type OperationalEligibilityResult = IneligibleResult | EligibleOperationalResult;

interface ViableTrim {
  readonly trim: OperationalTrimSnapshot;
  readonly rateConfigs: readonly RateConfigData[];
  readonly estimatedMonthly: number;
}

function parseRateConfigs(trim: OperationalTrimSnapshot): RateConfigData[] {
  const configs: RateConfigData[] = [];
  for (const sheet of trim.rateSheets) {
    if (
      sheet.productType !== DEFAULT_PUBLIC_QUOTE_PRODUCT_TYPE
      || !sheet.isActive
      || !sheet.financeCompany.isActive
    ) continue;
    const minRateMatrix = parseRateSheetRaw(sheet.minRateMatrix);
    const maxRateMatrix = parseRateSheetRaw(sheet.maxRateMatrix);
    if (!minRateMatrix || !maxRateMatrix) continue;
    configs.push({
      financeCompanyId: sheet.financeCompany.id,
      financeCompanyName: sheet.financeCompany.name,
      financeSurchargeRate: sheet.financeCompany.surchargeRate,
      minVehiclePrice: sheet.minVehiclePrice,
      maxVehiclePrice: sheet.maxVehiclePrice,
      minRateMatrix,
      maxRateMatrix,
      depositDiscountRate: sheet.depositDiscountRate,
      prepayAdjustRate: sheet.prepayAdjustRate,
    });
  }
  return configs;
}

function effectiveTrimPrice(trim: OperationalTrimSnapshot): number {
  return trim.discountPrice ?? trim.price;
}

function bestMonthly(
  price: number,
  configs: readonly RateConfigData[],
  annualMileage: SupportedRecommendationMileage
): number {
  let best = Number.POSITIVE_INFINITY;
  for (const config of configs) {
    const monthly = estimateMonthly(price, config, 48, annualMileage);
    if (monthly > 0 && monthly < best) best = monthly;
  }
  return Number.isFinite(best) ? best : 0;
}

function compareViableTrims(left: ViableTrim, right: ViableTrim): number {
  if (left.trim.isDefault !== right.trim.isDefault) return left.trim.isDefault ? -1 : 1;
  const priceDifference = effectiveTrimPrice(left.trim) - effectiveTrimPrice(right.trim);
  if (priceDifference !== 0) return priceDifference;
  return left.trim.id.localeCompare(right.trim.id);
}

export function assessOperationalEligibility(
  vehicle: OperationalVehicleSnapshot,
  annualMileage: SupportedRecommendationMileage
): OperationalEligibilityResult {
  const exclusion = getRecommendationExclusion(vehicle);
  if (exclusion) return { status: "excluded_vehicle_class", exclusion };
  if (!vehicle.isVisible) return { status: "hidden" };
  if (!vehicle.config) return { status: "no_profile" };
  if (!vehicle.config.isActive) return { status: "inactive_profile" };

  const parsedProfile = parseOverlapProfile(vehicle.config.profile);
  if (parsedProfile.kind !== "valid") {
    return {
      status: "invalid_profile",
      issues: parsedProfile.kind === "invalid"
        ? parsedProfile.issues
        : [{ path: ["version"], code: "legacy", message: "overlap-v2 프로필이 아닙니다." }],
    };
  }

  const visibleTrims = vehicle.trims.filter((trim) => trim.isVisible);
  const latestTrims = filterLatestRecommendationTrims(visibleTrims);
  if (latestTrims.length === 0) return { status: "no_visible_latest_trim" };

  const withRates = latestTrims.map((trim) => ({ trim, rateConfigs: parseRateConfigs(trim) }));
  if (withRates.every((item) => item.rateConfigs.length === 0)) {
    return { status: "no_valid_active_rate" };
  }

  const viable: ViableTrim[] = withRates
    .map((item) => ({
      ...item,
      estimatedMonthly: bestMonthly(effectiveTrimPrice(item.trim), item.rateConfigs, annualMileage),
    }))
    .filter((item) => item.estimatedMonthly > 0)
    .sort(compareViableTrims);
  if (viable.length === 0) return { status: "non_positive_quote" };

  const selected = viable[0];
  return {
    status: "eligible",
    profile: parsedProfile.profile,
    selectedTrim: selected.trim,
    rateConfigs: selected.rateConfigs,
    estimatedMonthly: selected.estimatedMonthly,
    modelYear: getRecommendationModelYear({
      brand: vehicle.brand,
      name: vehicle.name,
      defaultTrimName: selected.trim.name,
      lineupName: selected.trim.lineup?.name,
    }),
  };
}
