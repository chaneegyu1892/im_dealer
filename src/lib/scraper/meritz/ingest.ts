// 메리츠 렌터카 .xlsm → CapitalCatalogTrim 엔트리 생성 (파싱 + 우리DB 가격매칭 + 월납입금 산출).
import { parseMeritzRentWorkbook } from "./parse";
import { computeMonthlyRent } from "./calc";
import { matchMeritzTrim, type OurVehicle } from "./match";
import { WARN_UNMATCHED, WARN_MODEL_FALLBACK } from "../excel-capitals";
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
  /** 기간×거리별 잔가율(0~1) — 검증·재계산용 보존. 가격 매칭과 무관하게 엑셀에서 파싱된 값. */
  residualRates?: Record<string, number>;
  /** 36개월/1만km 보증금10% 월납입금 샘플 — 시트 보증금 할인율 산출용 (엑셀 원본 수식 추적으로 재현). */
  depositRate36_10000?: number;
  /** 36개월/1만km 선납금10% 월납입금 샘플 — 시트 선납 보정율 산출용. */
  prepayRate36_10000?: number;
  warnings: string[];
}

/** 확정 매핑 기반 가격 주입: 엑셀 트림코드(mdelCd) → 우리 트림 가격. 이름 매칭보다 우선. */
export type MappedPriceByMdelCd = Map<string, { trimId: string; price: number }>;

export interface MeritzIngestResult {
  entries: MeritzCatalogEntry[];
  summary: {
    total: number;
    mappedConfirmed: number; // 확정 매핑으로 가격 주입 (정확값)
    trimConfirmed: number;   // 이름 매칭으로 트림 확정
    modelFallback: number;
    unmatched: number;
    priced: number;
    unmatchedNames: string[]; // 수동 매핑 필요 트림명
    fallbackNames: string[];  // 트림 검토 요망 트림명
  };
}

export const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]/,.-]/g, "");
/** 메리츠 트림명 → 모델 라벨(그룹핑용): 프로모션/세대접두어·괄호 제거 후 배기량/연료 토큰 앞부분. */
export function modelLabel(name: string): string {
  const s = name
    .replace(/\[[^\]]*\]/g, " ") // [Select 프로모션] 등 대괄호 제거
    .replace(/(디\s*올\s*뉴|올\s*뉴|더\s*뉴|the\s+all\s+new|all\s+new|the\s+new|신형)\s*/gi, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ").trim();
  const m = s.match(/^(.*?)\s*(\d\.\d|가솔린|디젤|hev|ev|phev|lpg|lpi|\d{2,}인치|전기)/i);
  return ((m ? m[1] : s).replace(/\s+/g, " ").trim()) || s;
}

/** 워크북 버퍼 + 우리 차량목록 → 카탈로그 엔트리. weekOf/scrapedAt 은 라우트에서 부여.
 *  mappedPrices(확정 매핑)가 있으면 해당 트림은 이름 매칭 없이 그 가격을 주입(1순위). */
export function ingestMeritzRent(
  buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[], mappedPrices?: MappedPriceByMdelCd
): MeritzIngestResult {
  const { trims, constants } = parseMeritzRentWorkbook(buf);
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
      const match = matchMeritzTrim(t, ourVehicles);
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
        const v = computeMonthlyRent(t, price, c.months, c.distKm, constants);
        if (v && v > 0) baseRates[`${c.months}_${c.distKm}`] = v;
      }
      if (Object.keys(baseRates).length > 0) priced++;
      // 보증금10%·선납금10% 샘플 — 기준셀(36/1만) 견적이 있을 때만 (보정율 산출에 base 쌍 필요)
      if (baseRates["36_10000"]) {
        const dep = computeMonthlyRent(t, price, 36, 10000, constants, { depositRate: 0.1 });
        if (dep && dep > 0) depositRate36_10000 = dep;
        const pre = computeMonthlyRent(t, price, 36, 10000, constants, { prepayRate: 0.1 });
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

export type { OurVehicle, MeritzTrim };
