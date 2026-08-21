// 메리츠 수입신차 운용리스 .xlsm → CapitalCatalogTrim 엔트리 (파싱 + 우리DB 가격매칭 + 리스료 산출).
// 국산 신차리스 ingest 와 동일 shape/우선순위(확정 매핑 > 이름 매칭) — 같은 productType "리스"에
// 브랜드만 수입으로 추가되며 upsert 통합이라 국산·수입 파일이 서로 덮어쓰지 않는다.
// 차종 F열은 견적기 기준가라 가격으로 쓰지 않고, 우리 DB 트림가(계산서가)를 주입해 산출한다.
import { parseMeritzImportLeaseWorkbook } from "./import-lease-parse";
import { computeMonthlyImportLease, pickImportLeaseResidual } from "./import-lease-calc";
import { matchMeritzTrim, type OurVehicle } from "./match";
import { WARN_UNMATCHED, WARN_MODEL_FALLBACK } from "../excel-capitals";
import { norm, modelLabel, type MeritzCatalogEntry, type MeritzIngestResult, type MappedPriceByMdelCd } from "./ingest";

const CELLS: { months: number; distKm: number }[] = [
  { months: 36, distKm: 10000 }, { months: 36, distKm: 20000 }, { months: 36, distKm: 30000 },
  { months: 48, distKm: 10000 }, { months: 48, distKm: 20000 }, { months: 48, distKm: 30000 },
  { months: 60, distKm: 10000 }, { months: 60, distKm: 20000 }, { months: 60, distKm: 30000 },
];

/** 워크북 버퍼 + 우리 차량목록 → 수입 리스 카탈로그 엔트리. weekOf/scrapedAt 은 라우트에서 부여. */
export function ingestMeritzImportLease(
  buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[], mappedPrices?: MappedPriceByMdelCd
): MeritzIngestResult {
  const { trims, consts } = parseMeritzImportLeaseWorkbook(buf);
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

    // 잔가율 보존 — 표준(잔가보장사 랭킹 선택 최고잔가율)으로 기간×거리별 기록. 가격 매칭과 무관.
    const residualRates: Record<string, number> = {};
    for (const c of CELLS) {
      const pick = pickImportLeaseResidual(t, consts, t.msrp || 1, c.months, c.distKm);
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
      // 보증금10%·선수금10% 샘플 — 기준셀(36/1만) 견적이 있을 때만 (보정율 산출에 base 쌍 필요)
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
