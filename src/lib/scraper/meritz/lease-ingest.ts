// 메리츠 신차리스(운용리스) .xlsm → CapitalCatalogTrim 엔트리 (파싱 + 우리DB 가격매칭 + 매회리스료 산출).
// 렌트 ingest 와 동일 shape/우선순위(확정 매핑 > 이름 매칭) — productType "리스" 로 저장되어 렌트와 분리.
import { parseMeritzLeaseWorkbook } from "./lease-parse";
import { computeMonthlyLease } from "./lease-calc";
import { matchMeritzTrim, type OurVehicle } from "./match";
import { WARN_UNMATCHED, WARN_MODEL_FALLBACK } from "../excel-capitals";
import { norm, modelLabel, type MeritzCatalogEntry, type MeritzIngestResult, type MappedPriceByMdelCd } from "./ingest";

const CELLS: { months: number; distKm: number }[] = [
  { months: 36, distKm: 10000 }, { months: 36, distKm: 20000 }, { months: 36, distKm: 30000 },
  { months: 48, distKm: 10000 }, { months: 48, distKm: 20000 }, { months: 48, distKm: 30000 },
  { months: 60, distKm: 10000 }, { months: 60, distKm: 20000 }, { months: 60, distKm: 30000 },
];

/** 워크북 버퍼 + 우리 차량목록 → 리스 카탈로그 엔트리. weekOf/scrapedAt 은 라우트에서 부여. */
export function ingestMeritzLease(
  buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[], mappedPrices?: MappedPriceByMdelCd
): MeritzIngestResult {
  const { trims } = parseMeritzLeaseWorkbook(buf);
  const entries: MeritzCatalogEntry[] = [];
  let mappedConfirmed = 0, trimConfirmed = 0, modelFallback = 0, unmatched = 0, priced = 0;
  const unmatchedNames: string[] = [], fallbackNames: string[] = [];

  for (const t of trims) {
    const mdelCd = norm(t.manufacturer + "_" + t.name);
    const warnings: string[] = [];
    let price = 0;
    const mapped = mappedPrices?.get(mdelCd);
    if (mapped && mapped.price > 0) { mappedConfirmed++; price = mapped.price; }
    else {
      const match = matchMeritzTrim({ manufacturer: t.manufacturer, name: t.name }, ourVehicles);
      if (!match) { unmatched++; unmatchedNames.push(t.name); warnings.push(WARN_UNMATCHED); }
      else if (match.trimMatched) { trimConfirmed++; price = match.price; }
      else { modelFallback++; price = match.price; fallbackNames.push(t.name); warnings.push(WARN_MODEL_FALLBACK); }
    }

    const residualRates: Record<string, number> = {};
    for (const c of CELLS) {
      const r = t.residual[`${c.months}_${c.distKm}`];
      if (r && r > 0) residualRates[`${c.months}_${c.distKm}`] = r;
    }

    const baseRates: Record<string, number> = {};
    let depositRate36_10000: number | undefined;
    let prepayRate36_10000: number | undefined;
    if (price > 0) {
      for (const c of CELLS) {
        const v = computeMonthlyLease(t, price, c.months, c.distKm);
        if (v && v > 0) baseRates[`${c.months}_${c.distKm}`] = v;
      }
      if (Object.keys(baseRates).length > 0) priced++;
      // 보증금10%·선수금10% 샘플 — 기준셀(36/1만) 견적이 있을 때만 (보정율 산출에 base 쌍 필요)
      if (baseRates["36_10000"]) {
        const dep = computeMonthlyLease(t, price, 36, 10000, { depositRate: 0.1 });
        if (dep && dep > 0) depositRate36_10000 = dep;
        const pre = computeMonthlyLease(t, price, 36, 10000, { prepayRate: 0.1 });
        if (pre && pre > 0) prepayRate36_10000 = pre;
      }
    }
    const model = modelLabel(t.name);
    entries.push({
      brandCd: t.manufacturer, brandName: t.manufacturer,
      modelCd: norm(t.manufacturer + "_" + model), modelName: model,
      dtMdlCd: norm(t.name), dtMdlName: t.name,
      mdelCd, trimName: t.name,
      vehiclePrice: price, baseRates,
      residualRates: Object.keys(residualRates).length > 0 ? residualRates : undefined,
      depositRate36_10000, prepayRate36_10000, warnings,
    });
  }
  return {
    entries,
    summary: { total: trims.length, mappedConfirmed, trimConfirmed, modelFallback, unmatched, priced, unmatchedNames, fallbackNames },
  };
}
