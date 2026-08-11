// MG 렌터카 .xlsm → CapitalCatalogTrim 엔트리 (파싱 + 우리DB 가격매칭 + 월 대여료 산출).
import { parseMgRentWorkbook } from "./parse";
import { computeMonthlyRent, residualRate } from "./calc";
import { matchMeritzTrim, type OurVehicle } from "../meritz/match";
import { WARN_UNMATCHED, WARN_MODEL_FALLBACK } from "../excel-capitals";
import type { MeritzCatalogEntry, MeritzIngestResult, MappedPriceByMdelCd } from "../meritz/ingest";

const CELLS: { months: number; distKm: number }[] = [
  { months: 36, distKm: 10000 }, { months: 36, distKm: 20000 }, { months: 36, distKm: 30000 },
  { months: 48, distKm: 10000 }, { months: 48, distKm: 20000 }, { months: 48, distKm: 30000 },
  { months: 60, distKm: 10000 }, { months: 60, distKm: 20000 }, { months: 60, distKm: 30000 },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]/,._-]/g, "");
/** MG 제조사명 → 매칭용 브랜드 alias (현대자동차→현대 등). */
function makerAlias(m: string): string {
  if (m.includes("현대")) return "현대";
  if (m.includes("기아")) return "기아";
  if (m.includes("르노")) return "르노";
  if (m.includes("쉐보레") || m.includes("GM")) return "쉐보레";
  if (m.includes("KG") || m.includes("쌍용")) return "KG";
  return m;
}
/** MG 트림명(언더스코어) → 모델 라벨(그룹핑용). */
function modelLabel(name: string): string {
  const s = name.replace(/_/g, " ").replace(/\[[^\]]*\]/g, " ")
    .replace(/(디\s*올\s*뉴|올\s*뉴|더\s*뉴|신형|더뉴)\s*/gi, "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const m = s.match(/^(.*?)\s*(\d\.\d|가솔린|디젤|hev|ev|lpi|lpg|전기|\d{2,}인치)/i);
  return ((m ? m[1] : s).replace(/\s+/g, " ").trim()) || s;
}

/** 워크북 버퍼 + 우리 차량목록 → 카탈로그 엔트리 (메리츠와 동일 shape).
 *  mappedPrices(확정 매핑)가 있으면 해당 트림은 이름 매칭 없이 그 가격을 주입(1순위). */
export function ingestMgRent(
  buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[], mappedPrices?: MappedPriceByMdelCd
): MeritzIngestResult {
  const { trims } = parseMgRentWorkbook(buf);
  const entries: MeritzCatalogEntry[] = [];
  let mappedConfirmed = 0, trimConfirmed = 0, modelFallback = 0, unmatched = 0, priced = 0;
  const unmatchedNames: string[] = [], fallbackNames: string[] = [];

  for (const t of trims) {
    const brand = makerAlias(t.manufacturer);
    const displayName = t.name.replace(/_/g, " ").trim();
    const mdelCd = norm(brand + "_" + displayName);
    const warnings: string[] = [];
    let price = 0;
    const mapped = mappedPrices?.get(mdelCd);
    if (mapped && mapped.price > 0) { mappedConfirmed++; price = mapped.price; }
    else {
      const match = matchMeritzTrim({ manufacturer: brand, name: displayName }, ourVehicles);
      if (!match) { unmatched++; unmatchedNames.push(displayName); warnings.push(WARN_UNMATCHED); }
      else if (match.trimMatched) { trimConfirmed++; price = match.price; }
      else { modelFallback++; price = match.price; fallbackNames.push(displayName); warnings.push(WARN_MODEL_FALLBACK); }
    }

    const residualRates: Record<string, number> = {};
    for (const c of CELLS) {
      const r = residualRate(t, c.months, c.distKm);
      if (r > 0) residualRates[`${c.months}_${c.distKm}`] = r;
    }

    const baseRates: Record<string, number> = {};
    if (price > 0) {
      for (const c of CELLS) {
        const v = computeMonthlyRent(t, price, c.months, c.distKm);
        if (v && v > 0) baseRates[`${c.months}_${c.distKm}`] = v;
      }
      if (Object.keys(baseRates).length > 0) priced++;
    }
    const model = modelLabel(t.name);
    entries.push({
      brandCd: brand, brandName: brand,
      modelCd: norm(brand + "_" + model), modelName: model,
      dtMdlCd: norm(displayName), dtMdlName: displayName,
      mdelCd, trimName: displayName,
      vehiclePrice: price, baseRates,
      residualRates: Object.keys(residualRates).length > 0 ? residualRates : undefined,
      warnings,
    });
  }
  return {
    entries,
    summary: { total: trims.length, mappedConfirmed, trimConfirmed, modelFallback, unmatched, priced, unmatchedNames, fallbackNames },
  };
}
