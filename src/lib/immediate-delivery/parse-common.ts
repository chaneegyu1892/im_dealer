// 브랜드 파서 공용 헬퍼. 기아·현대 양식은 열 위치가 시트마다 달라 헤더 라벨 기반으로 열을 찾는다.
import * as XLSX from "xlsx";

export const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
export const numv = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
};

/** 시트 → 2차원 배열 (빈 셀 = ""). */
export function sheetRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
}

/** 앞쪽 몇 행에서 label 셀이 있는 헤더 행 인덱스를 찾는다. 없으면 -1. */
export function findHeaderRow(rows: unknown[][], label: string, scanRows = 6): number {
  for (let i = 0; i < Math.min(rows.length, scanRows); i++) {
    if (rows[i].some((c) => str(c) === label)) return i;
  }
  return -1;
}

/** 헤더 행에서 라벨 → 열 인덱스 맵. 같은 라벨이 여러 개면 첫 번째. */
export function labelCols(header: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  header.forEach((c, i) => {
    const s = str(c);
    if (s && !map.has(s)) map.set(s, i);
  });
  return map;
}

/**
 * "위와 동일" 의미로 비워둔 셀(공백 문자만 있는 셀) 처리.
 * 원본 엑셀은 반복 값을 " "로 비워두므로, 공백-only 셀은 직전 행 값을 이어받는다.
 */
export function carryForward(raw: unknown, prev: string): string {
  if (raw === undefined || raw === null || raw === "") return "";
  const s = String(raw);
  if (s.trim() === "") return prev; // 공백만 → 직전 값
  return s.trim();
}

/** 엑셀 시리얼 날짜(1900 체계) → "YYYY-MM-DD". 숫자가 아니면 원문 반환. */
export function excelSerialToDate(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n) || n < 20000 || n > 80000) return str(v);
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  return d.toISOString().slice(0, 10);
}

/** undefined/빈 값을 제거한 extra 객체. 전부 비면 undefined. */
export function compactExtra(obj: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "" || v === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
