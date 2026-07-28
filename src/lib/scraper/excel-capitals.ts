// 엑셀 견적기(.xlsm) 업로드 방식 캐피탈사 — 웹 스크래핑(connections) 대신 파일 업로드로 카탈로그 수집.
// 메리츠·MG캐피탈: 배포 엑셀 견적기. 장기렌트(렌터카 파일) 지원.

/** 엑셀 업로드 캐피탈사 종류(파서/계산기 디스패치용). */
export type ExcelCapitalKind = "meritz" | "mg";

export function excelCapitalKind(name: string): ExcelCapitalKind | null {
  if (name.includes("메리츠")) return "meritz";
  if (name.includes("MG") || name.includes("엠지")) return "mg";
  return null;
}

export function isExcelCapital(name: string): boolean {
  return excelCapitalKind(name) !== null;
}

/** 해당 캐피탈사·상품이 엑셀 업로드로 지원되는지. */
export function excelUploadSupported(name: string, productType: string): boolean {
  return isExcelCapital(name) && productType === "장기렌트";
}
