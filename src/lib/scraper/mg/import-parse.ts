// MG캐피탈 수입견적 .xlsx 파서 — 차량DB(브랜드/잔가군/차봇 잔가) + 잔가map(SNK/APS 그리드)
// + 견적관리자용(브랜드별 운용/금융/할부 IRR) + 운용리스 상수(인지세, 잔가보장수수료율).
// 운용리스 외에 금융리스/할부오토론 시트 계산기도 재현(import-finance-calc.ts). 상세 MG-NOTES.md.
import * as XLSX from "xlsx";

function cell(ws: XLSX.WorkSheet | undefined, r0: number, c0: number): any {
  if (!ws) return undefined;
  const v = ws[XLSX.utils.encode_cell({ r: r0, c: c0 })];
  return v ? v.v : undefined;
}
const num = (v: any): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: any): string => (v === undefined || v === null ? "" : String(v).trim());
const rows = (ws: XLSX.WorkSheet | undefined) => (ws && ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).e.r : -1);

export const LEASE_TERMS = [12, 24, 36, 48, 60] as const;

/** 차량DB 1행 (헤더 row5, 데이터 row6~). */
export interface MgImportTrim {
  manufacturer: string; // E: BRAND (AUDI/BMW/BENZ/Jaguar-Landrover 등 영문 표기)
  name: string;         // F: MODEL (트림 수준 명칭)
  disp: number;         // G: 배기량 (EV는 1)
  vehClass: string;     // H: 차종분류 (승용일반 등) — 취득세율 판정(LEFT 2자)
  msrp: number;         // I: 기본차량가(MSRP) — 참고용. 계산은 우리 DB 계산서가를 주입
  highResidual: boolean; // P="Y": 고잔가 가능 → 최대잔가 +8% & 잔가보장수수료 부과
  snkGrade: string;     // S: 에스앤케이모터스 잔가군
  apsGrade: string;     // Y: APS 잔가군
  snkPromo: number;     // AL: SNK 프로모션 가산율
  apsPromo: number;     // AK: APS 프로모션 가산율
  chabot: Record<number, number>; // AF~AJ: 차봇 기간별(12~60) 잔가율
}

/** 잔가군 → 기간(12~60) → 잔가율. 그리드 헤더가 숫자(27~31)인 잔가군도 문자열 키로 통일. */
export type ResidualGradeMap = Record<string, Record<number, number>>;

export interface MgImportConsts {
  snkMap: ResidualGradeMap;             // 잔가map ■에스앤케이모터스 (B2:AG7)
  apsMap: ResidualGradeMap;             // 잔가map ■APS (B13:AR18)
  irrByBrand: Record<string, number>;   // 견적관리자용 E9:F36 운용·당사명의 IRR (키는 normBrandKey)
  irrFinanceByBrand: Record<string, number>;     // 견적관리자용 H열 금융·당사명의 IRR
  irrInstallmentByBrand: Record<string, number>; // 견적관리자용 J열 할부 IRR
  stampDuty: number;                    // 운용리스 CI81 인지세
  gapFeeRate: { snk: number; aps: number }; // 잔가GAP=0 구간 잔가보장수수료율 (운용리스 CQ67/CR67)
}

/** IRR 테이블 키 정규화 — 차량DB(Jaguar-Landrover)와 견적관리자용(Jaguar_Landrover) 표기 차이 흡수. */
export const normBrandKey = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");

/** 잔가map 그리드 파싱: 헤더행(잔가군) × 좌측 기간열(12~60). */
function parseGradeGrid(ws: XLSX.WorkSheet, headerR0: number, colStart: number, colEnd: number): ResidualGradeMap {
  const map: ResidualGradeMap = {};
  for (let c = colStart; c <= colEnd; c++) {
    const grade = str(cell(ws, headerR0, c));
    if (!grade) continue;
    const byTerm: Record<number, number> = {};
    for (let i = 0; i < LEASE_TERMS.length; i++) {
      const months = num(cell(ws, headerR0 + 1 + i, 1)); // B열 기간 라벨
      const rate = num(cell(ws, headerR0 + 1 + i, c));
      if (LEASE_TERMS.includes(months as (typeof LEASE_TERMS)[number]) && rate > 0) byTerm[months] = rate;
    }
    if (Object.keys(byTerm).length > 0) map[grade] = byTerm;
  }
  return map;
}

/** MG 수입견적 워크북 파싱 → 트림 목록 + 계산 상수. */
export function parseMgImportWorkbook(buf: Buffer | ArrayBuffer): { trims: MgImportTrim[]; consts: MgImportConsts } {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array" });
  const db = wb.Sheets["차량DB"];
  const residMap = wb.Sheets["잔가map"];
  const lease = wb.Sheets["운용리스"];
  const admin = wb.Sheets["견적관리자용"];
  if (!db || !residMap || !lease || !admin) {
    throw new Error("'차량DB/잔가map/운용리스/견적관리자용' 시트를 찾을 수 없습니다. MG 수입견적 견적기 파일이 맞는지 확인하세요.");
  }

  const trims: MgImportTrim[] = [];
  const last = rows(db);
  for (let r = 5; r <= last; r++) { // 데이터 row6(r0=5)~
    const manufacturer = str(cell(db, r, 4)); // E
    const name = str(cell(db, r, 5));         // F
    if (!manufacturer || !name) continue;
    const chabot: Record<number, number> = {};
    LEASE_TERMS.forEach((months, i) => {
      const v = num(cell(db, r, 31 + i)); // AF~AJ
      if (v > 0) chabot[months] = v;
    });
    trims.push({
      manufacturer, name,
      disp: num(cell(db, r, 6)),            // G
      vehClass: str(cell(db, r, 7)) || "승용일반", // H
      msrp: num(cell(db, r, 8)),            // I
      highResidual: str(cell(db, r, 15)) === "Y", // P
      snkGrade: str(cell(db, r, 18)),       // S
      apsGrade: str(cell(db, r, 24)),       // Y
      snkPromo: num(cell(db, r, 37)),       // AL (운용리스 CR57 = col33 of F:AL)
      apsPromo: num(cell(db, r, 36)),       // AK (운용리스 CR56 = col32 of F:AL)
      chabot,
    });
  }

  const snkMap = parseGradeGrid(residMap, 1, 2, 32);   // 헤더 row2(C~AG), 기간 row3~7
  const apsMap = parseGradeGrid(residMap, 12, 2, 43);  // 헤더 row13(C~AR), 기간 row14~18

  const irrByBrand: Record<string, number> = {};
  const irrFinanceByBrand: Record<string, number> = {};
  const irrInstallmentByBrand: Record<string, number> = {};
  for (let r = 8; r <= 35; r++) { // 견적관리자용 E9:K36
    const brand = str(cell(admin, r, 4)); // E
    if (!brand) continue;
    const put = (m: Record<string, number>, c0: number) => {
      const irr = cell(admin, r, c0);
      if (typeof irr === "number" && irr > 0) m[normBrandKey(brand)] = irr;
    };
    put(irrByBrand, 5);           // F: 운용·당사명의
    put(irrFinanceByBrand, 7);    // H: 금융·당사명의
    put(irrInstallmentByBrand, 9); // J: 할부
  }

  const consts: MgImportConsts = {
    snkMap, apsMap, irrByBrand, irrFinanceByBrand, irrInstallmentByBrand,
    stampDuty: num(cell(lease, 80, 86)) || 10000,             // CI81
    gapFeeRate: {
      snk: num(cell(lease, 66, 94)) || 0.0132,                // CQ67
      aps: num(cell(lease, 66, 95)) || 0.011,                 // CR67
    },
  };
  if (trims.length === 0) throw new Error("차량DB 시트에서 트림을 찾지 못했습니다.");
  return { trims, consts };
}

/** MG 견적기 워크북 종류 판별(시트 구성) — 렌터카(차량_List) vs 수입 운용리스(차량DB+운용리스). */
export function detectMgQuoteVariant(buf: Buffer | ArrayBuffer): "rent" | "importLease" | null {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array", bookSheets: true });
  const names = new Set(wb.SheetNames);
  if (names.has("차량_List")) return "rent";
  if (names.has("차량DB") && names.has("운용리스")) return "importLease";
  return null;
}
