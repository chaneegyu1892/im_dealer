// 현대 재고리스트 파서 — 모델별 시트. "<모델>" = 정상(출고센터별 와이드), "<모델>(조건)" = 조건(1행 = 1대).
// 정상: 판매코드|사양코드|칼라코드(외/내)|재고|차종|옵션|외장|내장|가격 + [센터명(4열: 정상/조건/전시/판촉)]×N
//   센터 구성이 시트마다 달라 헤더에서 동적으로 읽는다. 센터별로 행을 분해해 저장.
// 조건: [구분]|판매코드|사양코드|칼라코드(외/내)|파츠코드|출고|판매조건계|기본조건|생산월조건|특별조건|한정조건|한정재고|계약번호|출고예정일|차종|옵션|외장|내장|가격|비고
//   ("구분" 열이 없는 시트 변형 존재)
import * as XLSX from "xlsx";
import type { ImmediateStockRow, ParsedImmediateStock } from "./types";
import {
  str, numv, sheetRows, findHeaderRow, labelCols, carryForward, compactExtra,
} from "./parse-common";

const CENTER_SUB_LABELS = ["정상", "조건", "전시", "판촉"] as const;

export function parseHyundaiWorkbook(wb: XLSX.WorkBook): ParsedImmediateStock {
  const rowsOut: ImmediateStockRow[] = [];
  const warnings: string[] = [];
  const skippedSheets: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const rows = sheetRows(wb.Sheets[sheetName]);
    if (str(rows[1]?.[0]) === "재고없음") { skippedSheets.push(sheetName); continue; }
    const hi = findHeaderRow(rows, "판매코드");
    if (hi < 0) { warnings.push(`현대: 시트 "${sheetName}" 헤더(판매코드)를 찾지 못해 건너뜀`); continue; }

    const cols = labelCols(rows[hi]);
    const isLimited = cols.has("판매조건계");
    const model = sheetName.replace(/\(조건\)$/, "").trim();
    const cSales = cols.get("판매코드")!;
    const cColor = cols.get("칼라코드");
    const cTrim = cols.get("차종");
    const cPrice = cols.get("가격");
    if (cColor === undefined || cTrim === undefined || cPrice === undefined) {
      warnings.push(`현대: 시트 "${sheetName}" 필수 열(칼라코드/차종/가격) 누락으로 건너뜀`);
      continue;
    }
    const cOption = cols.get("옵션") ?? cTrim + 1;
    const cExtName = cols.get("외/내장칼라") ?? cols.get("내/외장 칼라") ?? cOption + 1;

    // 정상 시트: 가격 오른쪽의 "○○출고/매암동/울산배송" 등 센터 헤더(각 4열: 정상/조건/전시/판촉)
    const centers: { name: string; col: number }[] = [];
    if (!isLimited) {
      const sub = rows[hi + 1] ?? [];
      for (const [label, col] of labelCols(rows[hi])) {
        if (col > cPrice && str(sub[col]) === "정상") centers.push({ name: label, col });
      }
    }

    let prevTrim = "";
    let emitted = 0;
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r];
      const salesCode = str(row[cSales]);
      if (!salesCode || salesCode === "합계") continue;
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
      const specExtra = {
        specCode: str(row[cSales + 1]),
        colorCode: `${str(row[cColor])}/${str(row[cColor + 1])}`,
      };

      if (isLimited) {
        rowsOut.push({
          ...base,
          stockType: "LIMITED",
          discount: numv(row[cols.get("판매조건계")!]) || undefined,
          quantity: 1,
          location: str(row[cols.get("출고") ?? -1]) || undefined,
          extra: compactExtra({
            ...specExtra,
            status: str(row[cols.get("구분") ?? -1]),
            partsCode: str(row[cols.get("파츠코드") ?? -1]),
            baseCondition: numv(row[cols.get("기본조건") ?? -1]),
            productionMonthCondition: numv(row[cols.get("생산월조건") ?? -1]),
            specialCondition: numv(row[cols.get("특별조건") ?? -1]),
            limitedCondition: numv(row[cols.get("한정조건") ?? -1]),
            limitedStock: numv(row[cols.get("한정재고") ?? -1]),
            contractNo: str(row[cols.get("계약번호") ?? -1]),
            expectedDeliveryDate: str(row[cols.get("출고예정일") ?? -1]),
            note: str(row[cols.get("비고") ?? -1]),
          }),
        });
        emitted++;
        continue;
      }

      // 정상: 센터별 수량으로 행 분해 (관리자 화면에서 센터별 재고가 보이도록)
      let centerEmitted = false;
      for (const center of centers) {
        const breakdown: Record<string, number> = {};
        let sum = 0;
        CENTER_SUB_LABELS.forEach((label, i) => {
          const n = numv(row[center.col + i]);
          if (n > 0) breakdown[label] = n;
          sum += n;
        });
        if (sum <= 0) continue;
        rowsOut.push({
          ...base,
          stockType: "NORMAL",
          quantity: sum,
          location: center.name,
          extra: compactExtra({ ...specExtra, breakdown }),
        });
        emitted++;
        centerEmitted = true;
      }
      // 센터 열에 수량이 전혀 없는데 총재고만 있는 행 대비
      if (!centerEmitted) {
        const qty = numv(row[cols.get("재고") ?? -1]);
        if (qty > 0) {
          rowsOut.push({ ...base, stockType: "NORMAL", quantity: qty, extra: compactExtra(specExtra) });
          emitted++;
        }
      }
    }
    if (emitted === 0) skippedSheets.push(sheetName);
  }

  return { brand: "현대", rows: rowsOut, warnings, skippedSheets };
}
