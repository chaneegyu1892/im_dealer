// 기아 재고리스트 파서 — 모델별 시트. "<모델>" = 정상(사양별 집계), "<모델>(한정)" = 한정(1행 = 1대).
// 정상: 판매코드|사양코드|칼라코드(외/내)|재고|차종|옵션|외장|내장|가격 (+한정/전시/감가 집계열)
// 한정: 구분|판매코드|사양코드|칼라코드(외/내)|[생산번호]|출하코드|출하지|생산일|판매조건계|[기본조건]|차종|옵션|외장|내장|가격 — 헤더 변형 3종
import * as XLSX from "xlsx";
import type { ImmediateStockRow, ParsedImmediateStock } from "./types";
import {
  str, numv, sheetRows, findHeaderRow, labelCols, carryForward, excelSerialToDate, compactExtra,
} from "./parse-common";

export function parseKiaWorkbook(wb: XLSX.WorkBook): ParsedImmediateStock {
  const rowsOut: ImmediateStockRow[] = [];
  const warnings: string[] = [];
  const skippedSheets: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const rows = sheetRows(wb.Sheets[sheetName]);
    if (str(rows[1]?.[0]) === "재고없음") { skippedSheets.push(sheetName); continue; }
    const hi = findHeaderRow(rows, "판매코드");
    if (hi < 0) { warnings.push(`기아: 시트 "${sheetName}" 헤더(판매코드)를 찾지 못해 건너뜀`); continue; }

    const cols = labelCols(rows[hi]);
    const isLimited = cols.has("판매조건계");
    const model = sheetName.replace(/\(한정\)$/, "").trim();
    const cSales = cols.get("판매코드")!;
    const cColor = cols.get("칼라코드");
    const cTrim = cols.get("차종");
    const cPrice = cols.get("가격");
    if (cColor === undefined || cTrim === undefined || cPrice === undefined) {
      warnings.push(`기아: 시트 "${sheetName}" 필수 열(칼라코드/차종/가격) 누락으로 건너뜀`);
      continue;
    }
    const cOption = cols.get("옵션") ?? cTrim + 1;
    // 외/내장 색상명은 "외/내장칼라"(정상) 또는 "내/외장 칼라"(한정) 라벨 열부터 2칸
    const cExtName = cols.get("외/내장칼라") ?? cols.get("내/외장 칼라") ?? cOption + 1;

    let prevTrim = "";
    let emitted = 0;
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r];
      const salesCode = str(row[cSales]);
      if (!salesCode || salesCode === "합계") continue; // 소계행·집계 서브헤더 스킵
      const trimName = (prevTrim = carryForward(row[cTrim], prevTrim));
      const base = {
        model,
        salesCode,
        trimName,
        optionText: str(row[cOption]) || undefined,
        exteriorColor: str(row[cExtName]) || undefined,
        interiorColor: str(row[cExtName + 1]) || undefined,
        price: numv(row[cPrice]) || undefined,
      };

      if (isLimited) {
        const cShip = cols.get("출하");
        rowsOut.push({
          ...base,
          stockType: "LIMITED",
          discount: numv(row[cols.get("판매조건계")!]) || undefined,
          quantity: 1,
          location: cShip !== undefined ? str(row[cShip + 1]) || undefined : undefined,
          extra: compactExtra({
            status: str(row[cols.get("구분") ?? -1]),
            specCode: str(row[cSales + 1]),
            colorCode: `${str(row[cColor])}/${str(row[cColor + 1])}`,
            productionNo: str(row[cols.get("생산번호") ?? -1]),
            shipCode: cShip !== undefined ? str(row[cShip]) : "",
            productionDate: cols.has("생산일") ? excelSerialToDate(row[cols.get("생산일")!]) : "",
            baseCondition: numv(row[cols.get("기본조건") ?? -1]),
          }),
        });
        emitted++;
      } else {
        const qty = numv(row[cols.get("재고") ?? -1]);
        if (qty <= 0) continue;
        // 정상 시트의 집계 서브헤더(한정/전시/감가)는 헤더 다음 행에 위치
        const sub = labelCols(rows[hi + 1] ?? []);
        rowsOut.push({
          ...base,
          stockType: "NORMAL",
          quantity: qty,
          extra: compactExtra({
            specCode: str(row[cSales + 1]),
            colorCode: `${str(row[cColor])}/${str(row[cColor + 1])}`,
            limitedCount: numv(row[sub.get("한정") ?? -1]),
            displayCount: numv(row[sub.get("전시") ?? -1]),
            depreciatedCount: numv(row[sub.get("감가") ?? -1]),
          }),
        });
        emitted++;
      }
    }
    if (emitted === 0) skippedSheets.push(sheetName);
  }

  return { brand: "기아", rows: rowsOut, warnings, skippedSheets };
}
