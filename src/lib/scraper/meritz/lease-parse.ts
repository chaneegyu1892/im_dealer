// 메리츠캐피탈 국산 신차리스 견적시트 .xlsm 파서 — 차량정보 시트(F~AZ) + EV 보조금 테이블(리스수식) → MeritzLeaseTrim[].
// 잔가율 그리드: O~AL = 기간(24/36/48/60, 행4) × 거리(10k/15k/20k/25k/30k/40k, 행5). 데이터 행 6~206.
import * as XLSX from "xlsx";
import type { MeritzLeaseTrim } from "./lease-calc";

function cell(ws: XLSX.WorkSheet | undefined, r0: number, c0: number): any {
  if (!ws) return undefined;
  const v = ws[XLSX.utils.encode_cell({ r: r0, c: c0 })];
  return v ? v.v : undefined;
}
const str = (v: any) => (v === undefined || v === null ? "" : String(v).trim());
const numv = (v: any) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };

// 잔가 그리드 컬럼(0-idx): O(14)~AL(37) = 기간 4개 × 거리 6개. 카탈로그는 36/48/60 × 10k/20k/30k 만 사용.
const GRID_START = 14; // O
const PERIODS = [24, 36, 48, 60];
const DISTANCES = [10000, 15000, 20000, 25000, 30000, 40000];

export interface ParsedMeritzLease { trims: MeritzLeaseTrim[] }

/** 신차리스 견적기 워크북 파싱 → 트림 목록. */
export function parseMeritzLeaseWorkbook(buf: Buffer | ArrayBuffer): ParsedMeritzLease {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array" });
  const S = wb.Sheets;
  const vws = S["차량정보"];
  const fws = S["리스수식"];
  if (!vws || !fws || !S["운용리스_입력"]) {
    throw new Error("'차량정보/리스수식/운용리스_입력' 시트를 찾을 수 없습니다. 메리츠 신차리스 견적기 파일이 맞는지 확인하세요.");
  }

  // ── EV 보조금: 국비(리스수식 P25:Q101, 차종명 키) + 추가(P107:Q198, "차종명 추가보조금" 키) ──
  const subsidyBase = new Map<string, number>();
  for (let r = 24; r <= 100; r++) {
    const nm = str(cell(fws, r, 15)); // P
    if (nm) subsidyBase.set(nm, numv(cell(fws, r, 16))); // Q
  }
  const subsidyExtra = new Map<string, number>();
  for (let r = 106; r <= 197; r++) {
    const nm = str(cell(fws, r, 15)).replace(/\s*추가보조금$/, "");
    if (nm) subsidyExtra.set(nm, numv(cell(fws, r, 16)));
  }

  // ── 차량정보 행6~206 → MeritzLeaseTrim ──
  const trims: MeritzLeaseTrim[] = [];
  for (let r = 5; r <= 205; r++) {
    const name = str(cell(vws, r, 7));         // H 차종
    if (!name) continue;
    const manufacturer = str(cell(vws, r, 6)); // G 제조사
    const residual: Record<string, number> = {};
    for (let p = 0; p < PERIODS.length; p++) {
      for (let d = 0; d < DISTANCES.length; d++) {
        const v = numv(cell(vws, r, GRID_START + p * DISTANCES.length + d));
        if (v > 0) residual[`${PERIODS[p]}_${DISTANCES[d]}`] = v;
      }
    }
    trims.push({
      manufacturer, name,
      kind: str(cell(vws, r, 8)) || "승용",     // I 종류
      discountRate: numv(cell(vws, r, 9)),      // J 할인율
      fuel: str(cell(vws, r, 10)),              // K 연료
      disp: numv(cell(vws, r, 12)),             // M 배기량
      carTaxAnnual: numv(cell(vws, r, 13)),     // N 차세(연간)
      residual,
      gaesoseExempt: str(cell(vws, r, 39)) === "면제", // AN 개소세
      deliveryFeeSeoul: numv(cell(vws, r, 41)), // AP 서울/경기/인천 탁송료
      evSubsidy: (subsidyBase.get(name) ?? 0) + (subsidyExtra.get(name) ?? 0),
    });
  }
  return { trims };
}
