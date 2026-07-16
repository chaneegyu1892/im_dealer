// 메리츠 렌터카 .xlsm → CapitalCatalogTrim 엔트리 생성 (파싱 + 우리DB 가격매칭 + 월납입금 산출).
import { parseMeritzRentWorkbook } from "./parse";
import { computeMonthlyRent } from "./calc";
import { matchMeritzTrim, type OurVehicle } from "./match";
import type { MeritzTrim } from "./calc";

// 카탈로그 매트릭스 9칸 (기간×거리km) — 타 캐피탈사와 동일 RATE_KEY.
const CELLS: { months: number; distKm: number }[] = [
  { months: 36, distKm: 10000 }, { months: 36, distKm: 20000 }, { months: 36, distKm: 30000 },
  { months: 48, distKm: 10000 }, { months: 48, distKm: 20000 }, { months: 48, distKm: 30000 },
  { months: 60, distKm: 10000 }, { months: 60, distKm: 20000 }, { months: 60, distKm: 30000 },
];

export interface MeritzCatalogEntry {
  brandCd: string; brandName: string;
  modelCd: string; modelName: string;
  dtMdlCd: string; dtMdlName?: string;
  mdelCd: string; trimName: string;
  vehiclePrice: number;
  baseRates: Record<string, number>;
  warnings: string[];
}

export interface MeritzIngestResult {
  entries: MeritzCatalogEntry[];
  summary: { total: number; trimConfirmed: number; modelFallback: number; unmatched: number; priced: number };
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]/,.-]/g, "");
/** 메리츠 트림명 → 모델 라벨(그룹핑용): 프로모션/세대접두어·괄호 제거 후 배기량/연료 토큰 앞부분. */
function modelLabel(name: string): string {
  const s = name
    .replace(/\[[^\]]*\]/g, " ") // [Select 프로모션] 등 대괄호 제거
    .replace(/(디\s*올\s*뉴|올\s*뉴|더\s*뉴|the\s+all\s+new|all\s+new|the\s+new|신형)\s*/gi, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ").trim();
  const m = s.match(/^(.*?)\s*(\d\.\d|가솔린|디젤|hev|ev|phev|lpg|lpi|\d{2,}인치|전기)/i);
  return ((m ? m[1] : s).replace(/\s+/g, " ").trim()) || s;
}

/** 워크북 버퍼 + 우리 차량목록 → 카탈로그 엔트리. weekOf/scrapedAt 은 라우트에서 부여. */
export function ingestMeritzRent(buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[]): MeritzIngestResult {
  const { trims, constants } = parseMeritzRentWorkbook(buf);
  const entries: MeritzCatalogEntry[] = [];
  let trimConfirmed = 0, modelFallback = 0, unmatched = 0, priced = 0;

  for (const t of trims) {
    const match = matchMeritzTrim(t, ourVehicles);
    const warnings: string[] = [];
    let price = 0;
    if (!match) { unmatched++; warnings.push("우리 DB 미매칭 — 수동 매핑 필요"); }
    else if (match.trimMatched) { trimConfirmed++; price = match.price; }
    else { modelFallback++; price = match.price; warnings.push("모델만 일치(base 트림 가격) — 트림 검토 요망"); }

    const baseRates: Record<string, number> = {};
    if (price > 0) {
      for (const c of CELLS) {
        const v = computeMonthlyRent(t, price, c.months, c.distKm, constants);
        if (v && v > 0) baseRates[`${c.months}_${c.distKm}`] = v;
      }
      if (Object.keys(baseRates).length > 0) priced++;
    }
    const model = modelLabel(t.name);
    entries.push({
      brandCd: t.manufacturer, brandName: t.manufacturer,
      modelCd: norm(t.manufacturer + "_" + model), modelName: model,
      dtMdlCd: norm(t.name), dtMdlName: t.name,
      mdelCd: norm(t.manufacturer + "_" + t.name), trimName: t.name,
      vehiclePrice: price, baseRates, warnings,
    });
  }
  return { entries, summary: { total: trims.length, trimConfirmed, modelFallback, unmatched, priced } };
}

export type { OurVehicle, MeritzTrim };
