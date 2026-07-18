// MG캐피탈 렌터카 견적기 .xlsm 파서 — 7개 상호연결 테이블 → MgTrim[].
// 차량_List(트림) + 잔가보장사(잔가군키·G/H/K/L) + 잔가(base) + 운영기준(이율) + 보험(연납) + 탁송(료) + 정비(충당금).
// 상세 컬럼구조 MG-NOTES.md. D-블록/미러 없음 — 각 시트 직접 파싱.
import * as XLSX from "xlsx";
import type { MgTrim } from "./calc";

function cell(ws: XLSX.WorkSheet | undefined, r0: number, c0: number): any {
  if (!ws) return undefined;
  const v = ws[XLSX.utils.encode_cell({ r: r0, c: c0 })];
  return v ? v.v : undefined;
}
const str = (v: any) => (v === undefined || v === null ? "" : String(v).trim());
const numv = (v: any) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const rows = (ws: XLSX.WorkSheet | undefined) => (ws && ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).e.r : -1);

const DELIVERY_CONST = 242500; // DT7add 30000 + DT9~14 112500 + 공채 100000
const MAINT_BASE = 7770;       // 정비 Basic = 충당금 + (5000+4170-1400+DK83)

export interface ParsedMg { trims: MgTrim[] }

/** 렌터카 견적기 워크북 파싱 → 트림 목록. */
export function parseMgRentWorkbook(buf: Buffer | ArrayBuffer): ParsedMg {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array" });
  const S = wb.Sheets;
  if (!S["차량_List"]) throw new Error("'차량_List' 시트를 찾을 수 없습니다. MG 렌터카 견적기 파일이 맞는지 확인하세요.");

  // ── 잔가보장사_잔가: 차종 → {잔가군(CD21), event(G), 차종특별(H), 48추가(K), 60추가(L)} ──
  const guar = new Map<string, { grp: number; event: number; special: number; add48: number; add60: number }>();
  const gws = S["잔가보장사_잔가"];
  for (let r = 3; r <= rows(gws); r++) {
    const nm = str(cell(gws, r, 2)); // C
    if (!nm) continue;
    guar.set(nm, { grp: numv(cell(gws, r, 3)), event: numv(cell(gws, r, 6)), special: numv(cell(gws, r, 7)), add48: numv(cell(gws, r, 10)), add60: numv(cell(gws, r, 11)) });
  }

  // ── 잔가(행67~97): 잔가군(B) → base잔가율[36(E)/48(F)/60(G)] ──
  const resBase = new Map<number, Record<number, number>>();
  const zws = S["잔가"];
  for (let r = 66; r <= Math.min(96, rows(zws)); r++) {
    const grp = numv(cell(zws, r, 1)); // B
    if (!grp) continue;
    resBase.set(grp, { 36: numv(cell(zws, r, 4)), 48: numv(cell(zws, r, 5)), 60: numv(cell(zws, r, 6)) });
  }

  // ── 운영기준: 차종(C) → {할인율(D), 이율[36(G)/48(H)/60(I)]} ──
  const oper = new Map<string, { rate: Record<number, number> }>();
  const ows = S["운영기준"];
  for (let r = 3; r <= rows(ows); r++) {
    const nm = str(cell(ows, r, 2)); // C
    if (!nm) continue;
    oper.set(nm, { rate: { 36: numv(cell(ows, r, 6)), 48: numv(cell(ows, r, 7)), 60: numv(cell(ows, r, 8)) } });
  }

  // ── 보험(행20, 대물1억): class → 연납 (E경차·F승용·G다인승7·H다인승9·I승합) ──
  const iws = S["보험"];
  const insByClass = (cls: string): number => {
    const col = /경차/.test(cls) ? 4 : /다인승.*9/.test(cls) ? 7 : /다인승/.test(cls) ? 6 : /승합/.test(cls) ? 8 : 5;
    return numv(cell(iws, 19, col)); // row20 (0-idx 19)
  };

  // ── 탁송(행3~): 출고지(B) → 서울/경기/인천 탁송료(C) ──
  const deliv = new Map<string, number>();
  const tws = S["탁송"];
  for (let r = 2; r <= rows(tws); r++) {
    const orig = str(cell(tws, r, 1)); // B
    if (orig) deliv.set(orig, numv(cell(tws, r, 2))); // C
  }

  // ── 정비(행33~): 차종(B) → 충당금(P=col15) ──
  const maint = new Map<string, number>();
  const mws = S["정비"];
  for (let r = 32; r <= rows(mws); r++) {
    const nm = str(cell(mws, r, 1)); // B
    if (nm) maint.set(nm, numv(cell(mws, r, 15))); // P
  }

  // ── 차량_List(행4~) → MgTrim 조립 ──
  const trims: MgTrim[] = [];
  const cws = S["차량_List"];
  for (let r = 3; r <= rows(cws); r++) {
    const name = str(cell(cws, r, 2)); // C 차종
    if (!name) continue;
    const g = guar.get(name);
    const op = oper.get(name);
    if (!g || !op) continue; // 잔가/이율 없으면 산출 불가
    const base = resBase.get(g.grp);
    if (!base) continue;
    const vehClass = str(cell(cws, r, 6)) || "승용"; // G
    const orig = str(cell(cws, r, 13)); // N 출고장
    const chungdang = maint.get(name);
    trims.push({
      manufacturer: str(cell(cws, r, 1)), name,
      disp: numv(cell(cws, r, 3)), fuel: str(cell(cws, r, 4)), teuksoK: numv(cell(cws, r, 5)) || 1.1, vehClass,
      residualBase: base,
      rvSpecial: g.special, rvEvent: g.event, rvAdd48: g.add48, rvAdd60: g.add60,
      rate: op.rate,
      insuranceAnnual: insByClass(vehClass),
      deliveryFee: (deliv.get(orig) ?? 0) + DELIVERY_CONST,
      maintMonthly: chungdang !== undefined ? chungdang + MAINT_BASE : 0,
    });
  }
  return { trims };
}
