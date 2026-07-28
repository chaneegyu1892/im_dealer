// 메리츠 렌터카 견적기 .xlsm 파서 — 차량정보(제조사별 병렬 블록) + 탁송 + 견적조건 기본이율 추출.
// D-블록(E:AP)은 선택 제조사(A6)의 동적 미러(수식)라 xlsx 로는 1개사만 보임 → 원본인 제조사 블록을 파싱.
// 블록 컬럼은 row5 라벨 기준 매핑(르노는 전략구분 컬럼이 없어 오프셋 고정 불가). 상세 MERITZ-NOTES.md.
import * as XLSX from "xlsx";
import type { MeritzTrim, MeritzConstants } from "./calc";

const MAKERS = ["현대", "기아", "KG", "르노", "쉐보레"];
// 카탈로그 매트릭스 셀 (기간×거리km)
const CELLS: { months: number; distKm: number }[] = [
  { months: 36, distKm: 10000 }, { months: 36, distKm: 20000 }, { months: 36, distKm: 30000 },
  { months: 48, distKm: 10000 }, { months: 48, distKm: 20000 }, { months: 48, distKm: 30000 },
  { months: 60, distKm: 10000 }, { months: 60, distKm: 20000 }, { months: 60, distKm: 30000 },
];
// 기간 그룹 내 거리 오프셋: 1만=+0, (1.5만=+1), 2만=+2, (2.5만=+3), 3만=+4
const DIST_OFFSET: Record<number, number> = { 10000: 0, 20000: 2, 30000: 4 };

function cell(ws: XLSX.WorkSheet, r0: number, c0: number): any {
  const v = ws[XLSX.utils.encode_cell({ r: r0, c: c0 })];
  return v ? v.v : undefined;
}
const str = (v: any) => (v === undefined || v === null ? "" : String(v).trim());
const numv = (v: any) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const isSeparator = (name: string) => !name || name === "0" || /^[-\s]+$/.test(name) || /■/.test(name);

interface BlockCols {
  maker: string; start: number;
  차종: number; 개소세: number; 보험등급: number; 전략: number; 유종: number; 배기량: number; 할인율: number; 잔가군: number;
  residual: Record<string, number>; // `${months}_${distKm}` → col
  irr: Record<string, number>;
}

/** 제조사 블록의 컬럼을 row5 라벨로 매핑. */
function mapBlock(ws: XLSX.WorkSheet, maker: string, start: number, end: number): BlockCols {
  const label = (c: number) => str(cell(ws, 4, c)).replace(/\s+/g, ""); // row5=index4, 공백 무시(예 "제조사 할인율")
  const find = (want: string) => { const w = want.replace(/\s+/g, ""); for (let c = start; c < end; c++) if (label(c) === w) return c; return -1; };
  const b: BlockCols = {
    maker, start,
    차종: find("차종"), 개소세: find("개소세"), 보험등급: find("보험등급"), 전략: find("전략구분"),
    유종: find("유종"), 배기량: find("배기량"), 할인율: find("제조사할인율"), 잔가군: find("잔가군"),
    residual: {}, irr: {},
  };
  // 잔가율: 잔가군 이후 "24/36/48/60" 라벨(책임보험 전) 4개
  const irrLabelCol = find("IRR조정");
  const periodCols: Record<number, number> = {};
  for (let c = b.잔가군 + 1; c < (irrLabelCol > 0 ? irrLabelCol : end); c++) {
    const l = label(c);
    if (l === "24" || l === "36" || l === "48" || l === "60") periodCols[Number(l)] = c;
  }
  for (const { months, distKm } of CELLS) {
    const pc = periodCols[months];
    if (pc !== undefined) b.residual[`${months}_${distKm}`] = pc + DIST_OFFSET[distKm];
  }
  // IRR조정: 라벨 다음 컬럼부터 24(7)/36(7)/48(7)/60(7)
  if (irrLabelCol > 0) {
    const irrStart = irrLabelCol + 1;
    const irrPeriodStart: Record<number, number> = { 24: irrStart, 36: irrStart + 7, 48: irrStart + 14, 60: irrStart + 21 };
    for (const { months, distKm } of CELLS) b.irr[`${months}_${distKm}`] = irrPeriodStart[months] + DIST_OFFSET[distKm];
  }
  return b;
}

/** 탁송 시트 → 트림명 → 서울/경기/인천 탁송료. */
function parseDelivery(wb: XLSX.WorkBook): Map<string, number> {
  const ws = wb.Sheets["탁송"];
  const map = new Map<string, number>();
  if (!ws) return map;
  const range = ws["!ref"];
  if (!range) return map;
  const ref = XLSX.utils.decode_range(range);
  // 헤더행에서 "서울/경기/인천" 컬럼 탐색(대개 row3)
  let seoulCol = -1, headerRow = -1;
  for (let r = 0; r <= Math.min(6, ref.e.r) && seoulCol < 0; r++)
    for (let c = ref.s.c; c <= ref.e.c; c++)
      if (/서울/.test(str(cell(ws, r, c)))) { seoulCol = c; headerRow = r; break; }
  if (seoulCol < 0) return map;
  // 트림명 컬럼 = 서울 컬럼 왼쪽에서 문자열 밀집 컬럼(대개 B). 헤더 아래로 스캔.
  const nameCol = seoulCol - 1;
  for (let r = headerRow + 1; r <= ref.e.r; r++) {
    const nm = str(cell(ws, r, nameCol));
    if (nm && !isSeparator(nm)) map.set(nm, numv(cell(ws, r, seoulCol)));
  }
  return map;
}

/** 견적조건 G36:H50 → 전략 → 기본이율. */
function parseStrategyRates(wb: XLSX.WorkBook): Record<string, number> {
  const ws = wb.Sheets["견적조건"];
  const out: Record<string, number> = {};
  if (!ws) return out;
  for (let r = 35; r <= 49; r++) { // G36:H50 (0-index 35..49)
    const k = str(cell(ws, r, 6)); // G
    if (k) out[k] = numv(cell(ws, r, 7)); // H
  }
  return out;
}

export interface ParsedMeritz { trims: MeritzTrim[]; constants: MeritzConstants }

/** 렌터카 견적기 워크북 파싱 → 트림 목록 + 전역상수. */
export function parseMeritzRentWorkbook(buf: Buffer | ArrayBuffer): ParsedMeritz {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array" });
  const ws = wb.Sheets["차량정보"];
  if (!ws) throw new Error("'차량정보' 시트를 찾을 수 없습니다. 렌터카 견적기 파일이 맞는지 확인하세요.");
  const range = ws["!ref"];
  if (!range) throw new Error("'차량정보' 시트의 데이터 범위를 찾을 수 없습니다.");
  const ref = XLSX.utils.decode_range(range);

  // 제조사 블록 시작점(row4=index3)
  const blockStarts: { maker: string; col: number }[] = [];
  for (let c = ref.s.c; c <= ref.e.c; c++) {
    const v = str(cell(ws, 3, c));
    const m = MAKERS.find((mk) => v.includes(mk));
    if (m) blockStarts.push({ maker: m, col: c });
  }
  const delivery = parseDelivery(wb);
  const trims: MeritzTrim[] = [];

  for (let i = 0; i < blockStarts.length; i++) {
    const { maker, col } = blockStarts[i];
    const end = i + 1 < blockStarts.length ? blockStarts[i + 1].col : ref.e.c + 1;
    const b = mapBlock(ws, maker, col, end);
    if (b.차종 < 0) continue;
    for (let r = 7; r <= ref.e.r; r++) { // 데이터 8행(index7)~
      const name = str(cell(ws, r, b.차종));
      if (isSeparator(name)) continue;
      const residual: Record<string, number> = {};
      const irrAdj: Record<string, number> = {};
      for (const { months, distKm } of CELLS) {
        const rc = b.residual[`${months}_${distKm}`];
        if (rc !== undefined) { const rv = numv(cell(ws, r, rc)); if (rv > 0) residual[`${months}_${distKm}`] = rv; }
        const ic = b.irr[`${months}_${distKm}`];
        if (ic !== undefined) irrAdj[`${months}_${distKm}`] = numv(cell(ws, r, ic));
      }
      if (Object.keys(residual).length === 0) continue; // 잔가율 없음 = 견적불가 트림
      trims.push({
        manufacturer: maker, name,
        gaesoseK: numv(cell(ws, r, b.개소세)) || 1.1,
        insGrade: str(cell(ws, r, b.보험등급)),
        strategy: b.전략 >= 0 ? str(cell(ws, r, b.전략)) : "기본",
        fuel: str(cell(ws, r, b.유종)),
        disp: numv(cell(ws, r, b.배기량)),
        mfrDiscount: numv(cell(ws, r, b.할인율)),
        rvGroup: str(cell(ws, r, b.잔가군)),
        residual, irrAdj,
        deliveryFeeSeoul: delivery.get(name) ?? 0,
        evSubsidy: 0,
      });
    }
  }
  return { trims, constants: { strategyBaseRate: parseStrategyRates(wb) } };
}
