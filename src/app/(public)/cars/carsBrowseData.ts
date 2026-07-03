import type { RepresentativeQuote } from "@/lib/representative-quote";
import type { VehicleListItem } from "@/types/api";

export interface QuoteSnapshot {
  readonly representativeQuotes: RepresentativeQuote[];
  readonly monthlyFrom: number;
}

export type QuoteResponse = {
  readonly data?: Record<string, QuoteSnapshot>;
};

export function compareWithQuoteLast(
  secondary: (a: VehicleListItem, b: VehicleListItem) => number,
  monthlyFrom: (vehicle: VehicleListItem) => number,
) {
  return (a: VehicleListItem, b: VehicleListItem) => {
    const aHasQuote = monthlyFrom(a) > 0;
    const bHasQuote = monthlyFrom(b) > 0;
    if (aHasQuote !== bHasQuote) return aHasQuote ? -1 : 1;
    return secondary(a, b);
  };
}
