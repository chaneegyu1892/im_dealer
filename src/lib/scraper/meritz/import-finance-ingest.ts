// 메리츠캐피탈 수입신차견적 .xlsm 금융리스/할부 → CapitalCatalogTrim 엔트리.
// 트림 목록·가격매칭은 운용리스 파서(차종 시트)를 공유하고, 금리는 워크북 노란색 수기입력 셀에서 읽는다.
// 두 상품은 주행거리·잔가군 개념이 없어 기간(36/48/60)별 값을 1만/2만/3만 셀에 동일하게 채운다.
// 운용리스와 달리 브랜드 IRR 취급불가 게이팅 없음(배포 예시가 운용리스 취급불가 브랜드 BYD).
import * as XLSX from "xlsx";
import { parseMeritzImportLeaseWorkbook } from "./import-lease-parse";
import { computeMonthlyImportFinance } from "./import-finance-calc";
import { matchMeritzTrim, type OurVehicle } from "./match";
import { WARN_UNMATCHED, WARN_MODEL_FALLBACK } from "../excel-capitals";
import { norm, modelLabel, type MeritzCatalogEntry, type MeritzIngestResult, type MappedPriceByMdelCd } from "./ingest";

const TERMS = [36, 48, 60] as const;
const DIST_KEYS = [10000, 20000, 30000] as const;

/** 표준금리 — '금융리스 입력' J22 / '할부 입력' J20 (정책표가 없어 배포 수기입력값이 SSOT). */
function readFinanceRate(buf: Buffer | ArrayBuffer, product: "금융리스" | "할부"): number {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array" });
  const sheetName = product === "금융리스" ? "금융리스 입력" : "할부 입력";
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`'${sheetName}' 시트를 찾을 수 없습니다. 메리츠 수입신차견적 파일이 맞는지 확인하세요.`);
  const addr = product === "금융리스" ? "J22" : "J20";
  const v = ws[addr]?.v;
  if (typeof v !== "number" || v <= 0 || v >= 1) {
    throw new Error(`'${sheetName}' ${addr} 금리 입력값이 올바르지 않습니다: ${String(v)}`);
  }
  return v;
}

/** 워크북 버퍼 + 우리 차량목록 → 금융리스/할부 카탈로그 엔트리. weekOf/scrapedAt 은 라우트에서 부여. */
export function ingestMeritzImportFinance(
  buf: Buffer | ArrayBuffer, ourVehicles: OurVehicle[], product: "금융리스" | "할부", mappedPrices?: MappedPriceByMdelCd
): MeritzIngestResult {
  const rate = readFinanceRate(buf, product);
  const { trims } = parseMeritzImportLeaseWorkbook(buf);
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
        const v = computeMonthlyImportFinance(price, months, rate); // 표준: 선수금 0
        if (v && v > 0) for (const d of DIST_KEYS) baseRates[`${months}_${d}`] = v;
      }
      if (Object.keys(baseRates).length > 0) priced++;
      if (baseRates["36_10000"]) {
        const dep = computeMonthlyImportFinance(price, 36, rate, { downPaymentRate: 0.1 }); // 선수금 10% 샘플
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
