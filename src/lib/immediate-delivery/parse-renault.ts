// 르노 재고리스트 파서 — 시트명에 모델·연식·재고 구분이 인코딩됨.
//   예: "그랑콜레오스 26MY 한정재고(400만원)", "필랑트 27MY 정상재고"
// 열은 단일 양식: 모델(코드)|연식|차종|옵션(코드)|옵션명|외장색|내장색|부산|전시차|합계. 가격 열은 없다.
import * as XLSX from "xlsx";
import type { ImmediateStockRow, ParsedImmediateStock } from "./types";
import { str, numv, sheetRows, findHeaderRow, labelCols, carryForward, compactExtra } from "./parse-common";

const SHEET_NAME_RE = /^(.+?)\s+(\d{2}MY)\s+(정상재고|한정재고)(?:\((.+?)\))?$/;

/** "400만원" → 4000000. 숫자 형태가 아니면 undefined (예: "용품장착"). */
function parseLimitedAmount(label: string | undefined): number | undefined {
  if (!label) return undefined;
  const m = label.match(/^([\d,.]+)\s*만원$/);
  return m ? Math.round(Number(m[1].replace(/,/g, "")) * 10000) : undefined;
}

export function parseRenaultWorkbook(wb: XLSX.WorkBook): ParsedImmediateStock {
  const rowsOut: ImmediateStockRow[] = [];
  const warnings: string[] = [];
  const skippedSheets: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const nameMatch = sheetName.trim().match(SHEET_NAME_RE);
    if (!nameMatch) { warnings.push(`르노: 시트명 "${sheetName}" 형식을 해석하지 못해 건너뜀`); continue; }
    const [, model, modelYear, stockLabel, condLabel] = nameMatch;
    const stockType = stockLabel === "정상재고" ? "NORMAL" : "LIMITED";
    const discount = stockType === "LIMITED" ? parseLimitedAmount(condLabel) : undefined;

    const rows = sheetRows(wb.Sheets[sheetName]);
    if (str(rows[1]?.[0]) === "재고없음") { skippedSheets.push(sheetName); continue; }
    const hi = findHeaderRow(rows, "모델");
    if (hi < 0) { warnings.push(`르노: 시트 "${sheetName}" 헤더(모델)를 찾지 못해 건너뜀`); continue; }
    const cols = labelCols(rows[hi]);
    const need = ["차종", "외장색", "내장색", "합계"].filter((k) => !cols.has(k));
    if (need.length > 0) {
      warnings.push(`르노: 시트 "${sheetName}" 필수 열(${need.join("/")}) 누락으로 건너뜀`);
      continue;
    }

    // 반복 값이 공백으로 비워진 열들은 직전 행 값을 이어받는다
    const prev = { modelCode: "", trimName: "", optionCode: "", optionText: "", ext: "", int: "" };
    let emitted = 0;
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r];
      const modelCode = (prev.modelCode = carryForward(row[cols.get("모델")!], prev.modelCode));
      const trimName = (prev.trimName = carryForward(row[cols.get("차종")!], prev.trimName));
      const optionCode = (prev.optionCode = carryForward(row[cols.get("옵션") ?? -1], prev.optionCode));
      const optionText = (prev.optionText = carryForward(row[cols.get("옵션명") ?? -1], prev.optionText));
      const ext = (prev.ext = carryForward(row[cols.get("외장색")!], prev.ext));
      const int = (prev.int = carryForward(row[cols.get("내장색")!], prev.int));
      if (str(row[cols.get("모델")!]) === "" && str(row[cols.get("합계")!]) === "") continue; // 빈 행
      const busan = numv(row[cols.get("부산") ?? -1]);
      const display = numv(row[cols.get("전시차") ?? -1]);
      const qty = numv(row[cols.get("합계")!]) || busan + display;
      if (qty <= 0 || !trimName) continue;

      rowsOut.push({
        model,
        stockType,
        salesCode: modelCode || undefined,
        trimName,
        optionText: optionText || undefined,
        exteriorColor: ext || undefined,
        interiorColor: int || undefined,
        discount,
        quantity: qty,
        extra: compactExtra({
          modelYear,
          optionCode,
          limitedCondition: stockType === "LIMITED" && discount === undefined ? condLabel : undefined,
          busanCount: busan,
          displayCount: display,
        }),
      });
      emitted++;
    }
    if (emitted === 0) skippedSheets.push(sheetName);
  }

  return { brand: "르노", rows: rowsOut, warnings, skippedSheets };
}
