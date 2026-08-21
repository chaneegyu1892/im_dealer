// 엑셀 견적기(.xlsm) 업로드 방식 캐피탈사 — 웹 스크래핑(connections) 대신 파일 업로드로 카탈로그 수집.
// 메리츠: 렌터카(장기렌트)·신차리스(국산/수입신차 운용리스)·수입신차(금융리스/할부) 파일 지원.
// MG캐피탈: 렌터카(장기렌트)·수입견적(운용리스/금융리스/할부) 지원.

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

// 엑셀 ingest 가 CapitalCatalogTrim.warnings 에 남기는 문구 — apply-catalog 의 반영 차단 판정과 공유.
export const WARN_UNMATCHED = "우리 DB 미매칭 — 수동 매핑 필요";
export const WARN_MODEL_FALLBACK = "모델만 일치(base 트림 가격) — 트림 검토 요망";
