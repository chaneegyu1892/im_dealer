import { createHash } from "crypto";

const CAPITAL_RATE_GROUP_COLORS = [
  "#2563EB", // blue
  "#7C3AED", // violet
  "#F97316", // orange
  "#059669", // emerald
  "#DC2626", // red
  "#0891B2", // cyan
  "#CA8A04", // amber
  "#DB2777", // pink
  "#4F46E5", // indigo
  "#16A34A", // green
] as const;

export type CapitalRateGroupFingerprintInput = {
  financeCompanyId: string;
  productType: string;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minBaseRates: unknown;
  minDepositRates: unknown;
  minPrepayRates: unknown;
  maxBaseRates: unknown;
  maxDepositRates: unknown;
  maxPrepayRates: unknown;
  minRateMatrix: unknown;
  maxRateMatrix: unknown;
  depositDiscountRate: number;
  prepayAdjustRate: number;
};

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortValue(item)])
    );
  }
  return value;
}

export function buildCapitalRateGroupPayload(sheet: CapitalRateGroupFingerprintInput) {
  return {
    financeCompanyId: sheet.financeCompanyId,
    productType: sheet.productType,
    minVehiclePrice: sheet.minVehiclePrice,
    maxVehiclePrice: sheet.maxVehiclePrice,
    minBaseRates: sortValue(sheet.minBaseRates),
    minDepositRates: sortValue(sheet.minDepositRates),
    minPrepayRates: sortValue(sheet.minPrepayRates),
    maxBaseRates: sortValue(sheet.maxBaseRates),
    maxDepositRates: sortValue(sheet.maxDepositRates),
    maxPrepayRates: sortValue(sheet.maxPrepayRates),
    minRateMatrix: sortValue(sheet.minRateMatrix),
    maxRateMatrix: sortValue(sheet.maxRateMatrix),
    depositDiscountRate: sheet.depositDiscountRate,
    prepayAdjustRate: sheet.prepayAdjustRate,
  };
}

/**
 * Fingerprint for "same recovery-rate values" groups.
 * Deliberately ignores registration metadata such as id, trimId, weekOf,
 * memo, createdAt, and isActive so historical timing never changes grouping.
 */
export function buildCapitalRateFingerprint(sheet: CapitalRateGroupFingerprintInput): string {
  return createHash("sha256")
    .update(JSON.stringify(buildCapitalRateGroupPayload(sheet)))
    .digest("hex");
}

export function buildCapitalRateGroupName(index: number): string {
  let n = Math.max(0, index);
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `그룹 ${label}`;
}

export function getCapitalRateGroupColor(index: number): string {
  return CAPITAL_RATE_GROUP_COLORS[Math.abs(index) % CAPITAL_RATE_GROUP_COLORS.length];
}

export { CAPITAL_RATE_GROUP_COLORS };
