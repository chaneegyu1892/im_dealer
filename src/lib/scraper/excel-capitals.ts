// 엑셀 견적기(.xlsm) 업로드 방식 캐피탈사 — 웹 스크래핑(connections) 대신 파일 업로드로 카탈로그 수집.
// 메리츠: 렌터카(장기렌트)·국산 신차리스(운용리스) 파일 지원. MG캐피탈: 렌터카(장기렌트) 지원.

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
  const kind = excelCapitalKind(name);
  if (kind === "meritz") return productType === "장기렌트" || productType === "리스";
  if (kind === "mg") return productType === "장기렌트";
  return false;
}

// 엑셀 ingest 가 CapitalCatalogTrim.warnings 에 남기는 문구 — apply-catalog 의 반영 차단 판정과 공유.
export const WARN_UNMATCHED = "우리 DB 미매칭 — 수동 매핑 필요";
export const WARN_MODEL_FALLBACK = "모델만 일치(base 트림 가격) — 트림 검토 요망";
