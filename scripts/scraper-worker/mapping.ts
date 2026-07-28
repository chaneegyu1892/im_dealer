import type { RateSheetRaw } from "../../src/types/admin";
import type { ScrapeDraft, ScrapeJobParams, TrimScrapeResult } from "../../src/types/scraper";

/**
 * 회수율 키 (기간_연간거리). src/lib/quote-calculator.ts 의 RATE_KEYS 와 동일하게 유지.
 * 워커를 자기완결적으로 두기 위해 여기서 별도 선언한다.
 */
export const RATE_KEYS = [
  "36_10000",
  "36_20000",
  "36_30000",
  "48_10000",
  "48_20000",
  "48_30000",
  "60_10000",
  "60_20000",
  "60_30000",
] as const;

export function emptyRates(): RateSheetRaw {
  return Object.fromEntries(RATE_KEYS.map((k) => [k, 0])) as RateSheetRaw;
}

function fillRates(partial: Partial<RateSheetRaw> | undefined): RateSheetRaw {
  const out = emptyRates();
  if (partial) {
    for (const k of RATE_KEYS) {
      const v = partial[k];
      if (typeof v === "number") out[k] = v;
    }
  }
  return out;
}

/**
 * 트림별 수집 결과를 기존 저장 모델(min/max 6개 표, 9개 키)로 조립한다.
 *
 * 가격 범위 규약(기존 시스템과 동일): 가장 저렴한 트림의 견적 → min*, 가장 비싼 트림 → max*.
 * 매칭 실패(unmatched) 트림은 경고로만 남기고 값에 반영하지 않는다.
 */
export function buildDraftFromTrimResults(
  results: TrimScrapeResult[],
  params: ScrapeJobParams,
  productType: string,
  scrapedAtISO: string
): ScrapeDraft {
  const warnings: string[] = [];
  const matched = results.filter((r) => r.matchConfidence !== "unmatched" && r.vehiclePrice > 0);

  for (const r of results) {
    warnings.push(...r.warnings);
    if (r.matchConfidence === "unmatched") {
      warnings.push(`트림 매칭 실패: "${r.externalTrimLabel}" (수동 입력 필요)`);
    } else if (r.matchConfidence === "fuzzy") {
      warnings.push(`트림 추정 매칭: "${r.externalTrimLabel}" — 확인 필요`);
    }
  }

  const trims = results.map((r) => ({
    trimId: r.trimId,
    matchConfidence: r.matchConfidence,
    externalTrimLabel: r.externalTrimLabel,
    vehiclePrice: r.vehiclePrice,
    // 라인업별 그룹핑용 트림별 월 지불액 (수집 성공분만)
    baseRates: r.vehiclePrice > 0 ? fillRates(r.baseRates) : undefined,
    depositRates:
      r.vehiclePrice > 0 && typeof r.depositRate36_10000 === "number"
        ? fillRates({ "36_10000": r.depositRate36_10000 })
        : undefined,
    prepayRates:
      r.vehiclePrice > 0 && typeof r.prepayRate36_10000 === "number"
        ? fillRates({ "36_10000": r.prepayRate36_10000 })
        : undefined,
  }));

  if (matched.length === 0) {
    warnings.push("수집된 유효 견적이 없습니다.");
    return {
      scrapedAt: scrapedAtISO,
      productType,
      weekOf: params.weekOf,
      trims,
      minVehiclePrice: params.minVehiclePrice,
      maxVehiclePrice: params.maxVehiclePrice,
      minBaseRates: emptyRates(),
      minDepositRates: emptyRates(),
      minPrepayRates: emptyRates(),
      maxBaseRates: emptyRates(),
      maxDepositRates: emptyRates(),
      maxPrepayRates: emptyRates(),
      warnings,
    };
  }

  const sorted = [...matched].sort((a, b) => a.vehiclePrice - b.vehiclePrice);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];

  const minDeposit = emptyRates();
  if (typeof low.depositRate36_10000 === "number") minDeposit["36_10000"] = low.depositRate36_10000;
  const minPrepay = emptyRates();
  if (typeof low.prepayRate36_10000 === "number") minPrepay["36_10000"] = low.prepayRate36_10000;
  const maxDeposit = emptyRates();
  if (typeof high.depositRate36_10000 === "number") maxDeposit["36_10000"] = high.depositRate36_10000;
  const maxPrepay = emptyRates();
  if (typeof high.prepayRate36_10000 === "number") maxPrepay["36_10000"] = high.prepayRate36_10000;

  return {
    scrapedAt: scrapedAtISO,
    productType,
    weekOf: params.weekOf,
    trims,
    minVehiclePrice: low.vehiclePrice,
    maxVehiclePrice: high.vehiclePrice,
    minBaseRates: fillRates(low.baseRates),
    minDepositRates: minDeposit,
    minPrepayRates: minPrepay,
    maxBaseRates: fillRates(high.baseRates),
    maxDepositRates: maxDeposit,
    maxPrepayRates: maxPrepay,
    warnings,
  };
}
