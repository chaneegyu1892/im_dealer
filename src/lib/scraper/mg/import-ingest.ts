// MG캐피탈 수입견적(운용리스) .xlsx → CapitalCatalogTrim 엔트리 (파싱 + 우리DB 가격매칭 + 월납입금 산출).
// 메리츠 리스 ingest 와 동일 shape/우선순위(확정 매핑 > 이름 매칭) — productType "리스" 로 저장되어 렌트와 분리.
// 엑셀 I열은 MSRP(기본차량가)라 가격으로 쓰지 않고, 우리 DB 트림가(계산서가)를 주입해 산출한다.
import { parseMgImportWorkbook } from "./import-parse";
import { computeMonthlyImportLease, pickResidual } from "./import-calc";
import { matchMeritzTrim, type OurVehicle } from "../meritz/match";
import { WARN_UNMATCHED, WARN_MODEL_FALLBACK } from "../excel-capitals";
import { norm, modelLabel, type MeritzCatalogEntry, type MeritzIngestResult, type MappedPriceByMdelCd } from "../meritz/ingest";

const CELLS: { months: number; distKm: number }[] = [
  { months: 36, distKm: 10000 }, { months: 36, distKm: 20000 }, { months: 36, distKm: 30000 },
  { months: 48, distKm: 10000 }, { months: 48, distKm: 20000 }, { months: 48, distKm: 30000 },
  { months: 60, distKm: 10000 }, { months: 60, distKm: 20000 }, { months: 60, distKm: 30000 },
];

/** 워크북 버퍼 + 우리 차량목록 → 수입 리스 카탈로그 엔트리. weekOf/scrapedAt 은 라우트에서 부여. */
export function ingestMgImportLease(
  buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[], mappedPrices?: MappedPriceByMdelCd
): MeritzIngestResult {
  const { trims, consts } = parseMgImportWorkbook(buf);
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

    // 잔가율 보존 — 표준(최대잔가율, CR62)과 동일한 선택 로직으로 기간×거리별 기록. 가격 매칭과 무관.
    const residualRates: Record<string, number> = {};
    for (const c of CELLS) {
      const pick = pickResidual(t, consts, c.months, c.distKm);
      // 저장은 동률방지 미소가산(1e-11) 제거한 6자리 반올림 — 계산은 pick.rate 원값 사용
      if (pick && pick.rate > 0) residualRates[`${c.months}_${c.distKm}`] = Math.round(pick.rate * 1e6) / 1e6;
    }

    const baseRates: Record<string, number> = {};
    let depositRate36_10000: number | undefined;
    let prepayRate36_10000: number | undefined;
    if (price > 0) {
      for (const c of CELLS) {
        const v = computeMonthlyImportLease(t, price, c.months, c.distKm, consts);
        if (v && v > 0) baseRates[`${c.months}_${c.distKm}`] = v;
      }
      if (Object.keys(baseRates).length > 0) priced++;
      // 보증금10%·선납금10% 샘플 — 기준셀(36/1만) 견적이 있을 때만 (보정율 산출에 base 쌍 필요)
      if (baseRates["36_10000"]) {
        const dep = computeMonthlyImportLease(t, price, 36, 10000, consts, { depositRate: 0.1 });
        if (dep && dep > 0) depositRate36_10000 = dep;
        const pre = computeMonthlyImportLease(t, price, 36, 10000, consts, { prepayRate: 0.1 });
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
