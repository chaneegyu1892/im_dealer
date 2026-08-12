// 메리츠 수입차 렌터카 견적기 .xlsm 파서 — 차량정보(브랜드 병렬 블록: TESLA/폴스타/BYD) + 정비/탁송/보조금 테이블.
// 블록 레이아웃: [선행컬럼=특판할인액][차종·개소세·차량등급·보험등급·전략구분·유종·환개금·배기량·할인율·잔가군]
//   [잔가 그리드 24/36/48/60 × 7(1만/1.5만/2만/2.5만/3만/4만/무제한)][책임보험구분][이름][IRR 그리드 동일 4×7]
import * as XLSX from "xlsx";
import type { MeritzImportTrim, MeritzImportConstants } from "./import-rent-calc";

function cell(ws: XLSX.WorkSheet | undefined, r0: number, c0: number): any {
  if (!ws) return undefined;
  const v = ws[XLSX.utils.encode_cell({ r: r0, c: c0 })];
  return v ? v.v : undefined;
}
const str = (v: any) => (v === undefined || v === null ? "" : String(v).trim());
const numv = (v: any) => { const n = Number(String(v ?? "").replace(/[^\d.-]/g, "")); return isNaN(n) ? 0 : n; };
const col = (a: string) => XLSX.utils.decode_col(a);
const rows = (ws: XLSX.WorkSheet | undefined) => (ws && ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).e.r : -1);

// 브랜드 블록 (2607.v1 기준 고정 컬럼). discountExtraRate: 폴스타는 할인율 수식에 +13% 하드코딩.
const BLOCKS = [
  { brand: "TESLA", nameCol: "BV", discountCol: "BU", extraRate: 0 },
  { brand: "폴스타", nameCol: "EM", discountCol: "EL", extraRate: 0.13 },
  { brand: "BYD", nameCol: "HD", discountCol: "HC", extraRate: 0 },
];
// 그리드: 기간 4개 × 7칸(1만/1.5만/2만/2.5만/3만/4만/무제한). 카탈로그는 36/48/60 × 1만/2만/3만.
const PERIOD_IDX: [number, number][] = [[1, 36], [2, 48], [3, 60]];
const DIST_IDX: [number, number][] = [[0, 10000], [2, 20000], [4, 30000]];

export interface ParsedMeritzImport { trims: MeritzImportTrim[]; constants: MeritzImportConstants }

/** 수입차 렌터카 견적기 워크북 파싱 → 트림 목록 + 전략 이율표. */
export function parseMeritzImportRentWorkbook(buf: Buffer | ArrayBuffer): ParsedMeritzImport {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array" });
  const S = wb.Sheets;
  const vws = S["차량정보"];
  const qws = S["견적조건"];
  if (!vws || !qws || !S["렌트_입력"]) {
    throw new Error("'차량정보/견적조건/렌트_입력' 시트를 찾을 수 없습니다. 메리츠 수입차 렌터카 견적기 파일이 맞는지 확인하세요.");
  }

  // ── 전략 이율표(견적조건 G36:H49) ──
  const strategyBaseRate: Record<string, number> = {};
  for (let r = 35; r <= 48; r++) {
    const k = str(cell(qws, r, 6)); // G
    if (k) strategyBaseRate[k] = numv(cell(qws, r, 7)); // H
  }

  // ── 정비(C=차종, Y=면책100만 Basic 월액) ──
  const maint = new Map<string, number>();
  const mws = S["정비"];
  for (let r = 4; r <= rows(mws); r++) {
    const nm = str(cell(mws, r, 2)); // C
    if (nm) maint.set(nm, numv(cell(mws, r, col("Y"))));
  }

  // ── 탁송(B=차종, C=서울/경기/인천, O=세차 대형여부) ──
  const deliv = new Map<string, { fee: number; bigWash: boolean }>();
  const tws = S["탁송"];
  for (let r = 3; r <= rows(tws); r++) {
    const nm = str(cell(tws, r, 1)); // B
    if (nm) deliv.set(nm, { fee: numv(cell(tws, r, 2)), bigWash: str(cell(tws, r, col("O"))) === "O" });
  }

  // ── EV 보조금(견적조건 C137:D186 + C189:D238 "(특판출고) 자동반영" 접미) ──
  const subsidy1 = new Map<string, number>();
  for (let r = 136; r <= 185; r++) {
    const nm = str(cell(qws, r, 2)); // C
    if (nm) subsidy1.set(nm, numv(cell(qws, r, 3)));
  }
  const subsidy2 = new Map<string, number>();
  for (let r = 188; r <= 237; r++) {
    const nm = str(cell(qws, r, 2)).replace(/\s*\(특판출고\) 자동반영$/, "");
    if (nm) subsidy2.set(nm, numv(cell(qws, r, 3)));
  }

  // ── 브랜드 블록 → 트림 (데이터 행 8~144 = 0-idx 7~143) ──
  const trims: MeritzImportTrim[] = [];
  for (const b of BLOCKS) {
    const nc = col(b.nameCol);
    if (str(cell(vws, 3, nc)) === "" && str(cell(vws, 4, nc)) === "") continue; // 블록 없음(포맷 변경) — 존재 블록만
    const gridStart = nc + 10;
    const irrStart = gridStart + 28 + 2; // 잔가 4×7 + 책임보험구분 + 이름
    for (let r = 7; r <= 143; r++) {
      const name = str(cell(vws, r, nc));
      if (!name || /^[-\s]+$/.test(name) || /■/.test(name)) continue;
      const residual: Record<string, number> = {};
      const irrAdj: Record<string, number> = {};
      for (const [pi, months] of PERIOD_IDX) {
        for (const [di, distKm] of DIST_IDX) {
          const rv = numv(cell(vws, r, gridStart + pi * 7 + di));
          if (rv > 0) residual[`${months}_${distKm}`] = rv;
          irrAdj[`${months}_${distKm}`] = numv(cell(vws, r, irrStart + pi * 7 + di));
        }
      }
      if (Object.keys(residual).length === 0) continue; // 잔가율 없음 = 견적불가 트림
      const d = deliv.get(name);
      trims.push({
        manufacturer: b.brand, name,
        gaesoseK: numv(cell(vws, r, nc + 1)) || 1.1,
        strategy: str(cell(vws, r, nc + 4)) || "일반",
        fuel: str(cell(vws, r, nc + 5)),
        disp: numv(cell(vws, r, nc + 7)),
        discountAmt: numv(cell(vws, r, col(b.discountCol))),
        discountExtraRate: b.extraRate,
        rvGroup: str(cell(vws, r, nc + 9)),
        residual, irrAdj,
        maintMonthly: maint.get(name) ?? 0,
        deliveryFeeSeoul: d?.fee ?? 0,
        bigWash: d?.bigWash ?? false,
        evSubsidy: (subsidy1.get(name) ?? 0) + (subsidy2.get(name) ?? 0),
      });
    }
  }
  return { trims, constants: { strategyBaseRate } };
}

/** 메리츠 렌터카 워크북 변종 판별 — 국산(렌트_입력시트) vs 수입(렌트_입력). */
export function detectMeritzRentVariant(buf: Buffer | ArrayBuffer): "domestic" | "import" | null {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array", bookSheets: true });
  const names = wb.SheetNames ?? [];
  if (names.includes("렌트_입력시트")) return "domestic";
  if (names.includes("렌트_입력")) return "import";
  return null;
}
