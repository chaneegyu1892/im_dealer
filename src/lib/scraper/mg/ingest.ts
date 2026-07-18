// MG 렌터카 .xlsm → CapitalCatalogTrim 엔트리 (파싱 + 우리DB 가격매칭 + 월 대여료 산출).
import { parseMgRentWorkbook } from "./parse";
import { computeMonthlyRent } from "./calc";
import { matchMeritzTrim, type OurVehicle } from "../meritz/match";
import type { MeritzCatalogEntry, MeritzIngestResult } from "../meritz/ingest";

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

/** 워크북 버퍼 + 우리 차량목록 → 카탈로그 엔트리 (메리츠와 동일 shape). */
export function ingestMgRent(buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[]): MeritzIngestResult {
  const { trims } = parseMgRentWorkbook(buf);
  const entries: MeritzCatalogEntry[] = [];
  let trimConfirmed = 0, modelFallback = 0, unmatched = 0, priced = 0;

  for (const t of trims) {
    const brand = makerAlias(t.manufacturer);
    const displayName = t.name.replace(/_/g, " ").trim();
    const match = matchMeritzTrim({ manufacturer: brand, name: displayName }, ourVehicles);
    const warnings: string[] = [];
    let price = 0;
    if (!match) { unmatched++; warnings.push("우리 DB 미매칭 — 수동 매핑 필요"); }
    else if (match.trimMatched) { trimConfirmed++; price = match.price; }
    else { modelFallback++; price = match.price; warnings.push("모델만 일치(base 트림 가격) — 트림 검토 요망"); }

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
      mdelCd: norm(brand + "_" + displayName), trimName: displayName,
      vehiclePrice: price, baseRates, warnings,
    });
  }
  return { entries, summary: { total: trims.length, trimConfirmed, modelFallback, unmatched, priced } };
}
