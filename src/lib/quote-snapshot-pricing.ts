/** SavedQuote.breakdown 에 남은 저장 시점 트림가. 현재 Trim 테이블과 섞지 않는다. */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readMoney(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function deriveEffectiveTrimPrice(breakdown: Record<string, unknown>): number | null {
  const total = readMoney(breakdown.totalVehiclePrice);
  if (total == null) return null;
  const options = readMoney(breakdown.optionsTotalPrice) ?? 0;
  const colorDelta = readMoney(breakdown.colorDelta) ?? 0;
  const effective = total - options - colorDelta;
  return Number.isFinite(effective) && effective >= 0 ? effective : null;
}

export interface SnapshotTrimPricing {
  trimPrice: number | null;
  discountPrice: number | null;
  /** snapshot: breakdown 에 가격이 있음. derived: 총액에서 역산. none: 저장값 없음. */
  source: "snapshot" | "derived" | "none";
}

export function readSnapshotTrimPricing(breakdown: unknown): SnapshotTrimPricing {
  const record = asRecord(breakdown);
  const trimPrice = readMoney(record.trimPrice);
  const hasExplicitDiscount = "discountPrice" in record;
  const storedDiscount = record.discountPrice === null
    ? null
    : readMoney(record.discountPrice);

  if (hasExplicitDiscount && (typeof storedDiscount === "number" || record.discountPrice === null)) {
    if (trimPrice == null && storedDiscount == null) {
      return { trimPrice: null, discountPrice: null, source: "none" };
    }
    return { trimPrice, discountPrice: storedDiscount, source: "snapshot" };
  }

  if (trimPrice != null) {
    const derived = deriveEffectiveTrimPrice(record);
    if (derived != null && derived !== trimPrice) {
      return { trimPrice, discountPrice: derived, source: "derived" };
    }
    return { trimPrice, discountPrice: null, source: "snapshot" };
  }

  const derived = deriveEffectiveTrimPrice(record);
  if (derived != null) {
    return { trimPrice: derived, discountPrice: derived, source: "derived" };
  }

  return { trimPrice: null, discountPrice: null, source: "none" };
}
