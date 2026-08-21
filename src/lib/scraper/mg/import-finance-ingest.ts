// MG캐피탈 수입견적 .xlsx 금융리스/할부오토론 → CapitalCatalogTrim 엔트리.
// 운용리스 ingest(import-ingest.ts)와 동일 shape — productType "금융리스"/"할부" 로 저장되어 리스와 분리.
// 두 상품은 주행거리 개념이 없어 기간(36/48/60)별 값을 1만/2만/3만 셀에 동일하게 채운다.
import { parseMgImportWorkbook } from "./import-parse";
import { computeMonthlyMgFinanceLease, computeMonthlyMgInstallment } from "./import-finance-calc";
import { matchMeritzTrim, type OurVehicle } from "../meritz/match";
import { WARN_UNMATCHED, WARN_MODEL_FALLBACK } from "../excel-capitals";
import { norm, modelLabel, type MeritzCatalogEntry, type MeritzIngestResult, type MappedPriceByMdelCd } from "../meritz/ingest";

const TERMS = [36, 48, 60] as const;
const DIST_KEYS = [10000, 20000, 30000] as const;

/** 워크북 버퍼 + 우리 차량목록 → 금융리스/할부 카탈로그 엔트리. weekOf/scrapedAt 은 라우트에서 부여. */
export function ingestMgImportFinance(
  buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[], product: "금융리스" | "할부", mappedPrices?: MappedPriceByMdelCd
): MeritzIngestResult {
  const { trims, consts } = parseMgImportWorkbook(buf);
  const compute = product === "금융리스" ? computeMonthlyMgFinanceLease : computeMonthlyMgInstallment;
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

    const baseRates: Record<string, number> = {};
    let depositRate36_10000: number | undefined;
    if (price > 0) {
      for (const months of TERMS) {
        const v = compute(t, price, months, consts);
        if (v && v > 0) for (const d of DIST_KEYS) baseRates[`${months}_${d}`] = v;
      }
      if (Object.keys(baseRates).length > 0) priced++;
      if (baseRates["36_10000"]) {
        const dep = compute(t, price, 36, consts, { depositRate: 0.1 }); // 선수금 10% 샘플
        if (dep && dep > 0) depositRate36_10000 = dep;
      }
    }
    const model = modelLabel(t.name);
    entries.push({
      brandCd: t.manufacturer, brandName: t.manufacturer,
      modelCd: norm(t.manufacturer + "_" + model), modelName: model,
      dtMdlCd: norm(t.name), dtMdlName: t.name,
      mdelCd, trimName: t.name,
      vehiclePrice: price, baseRates,
      depositRate36_10000, warnings,
    });
  }
  return {
    entries,
    summary: { total: trims.length, mappedConfirmed, trimConfirmed, modelFallback, unmatched, priced, unmatchedNames, fallbackNames },
  };
}
