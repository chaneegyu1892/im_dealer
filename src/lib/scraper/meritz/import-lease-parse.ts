// 메리츠캐피탈 수입신차견적 .xlsm 파서 — 운용리스만 대상 (금융리스/할부 시트는 상품 타입 미지원으로 보류).
// 차종(1,200행: 브랜드/취득세구분/잔가군 5종) + 잔가(잔가보장 5사 그리드) + 취득세 테이블 + 브랜드 IRR + 운용리스 입력 상수.
import * as XLSX from "xlsx";

function cell(ws: XLSX.WorkSheet | undefined, r0: number, c0: number): unknown {
  if (!ws) return undefined;
  const v = ws[XLSX.utils.encode_cell({ r: r0, c: c0 })];
  return v ? v.v : undefined;
}
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v).trim());
const rows = (ws: XLSX.WorkSheet | undefined) => (ws && ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).e.r : -1);

export const IMPORT_LEASE_TERMS = [12, 24, 36, 48, 60] as const;

/** 잔가보장사 키 — 잔가 시트 행 순서(West/AJ/APS/VGS/자체잔가). 선택 동률 시 이 순서가 우선. */
export const RESIDUAL_COMPANIES = ["west", "aj", "aps", "vgs", "self"] as const;
export type ResidualCompany = (typeof RESIDUAL_COMPANIES)[number];

/** 차종 1행 (헤더 row6, 데이터 row7~). */
export interface MeritzImportLeaseTrim {
  manufacturer: string; // B: Maker (Audi/Benz/BMW/Landrover 등 영문)
  name: string;         // E: Model3 (트림 수준 명칭)
  msrp: number;         // F: 차량가격 — 참고용(계산은 우리 DB 계산서가 주입)
  disp: number;         // G: 배기량
  taxClass: string;     // I: 취득세 구분 (승용/RV(5인이하)/전기 등)
  grades: Record<ResidualCompany, string>; // J~N: 웨스트/오토준(AJ)/APS/VGS/IN(자체) 잔가군
  highResidualBlocked: boolean; // P: "고잔가불가" → 고잔가 8% 미적용
  hiResExtra15k: number; // Q: 고잔가추가(1.5만km 미만) 가산율
  hiResExtra10k: number; // R: 고잔가추가1(1만km 미만) 가산율
}

export type ImportGradeGrid = Record<string, Record<number, number>>;

export interface MeritzImportLeaseConsts {
  grids: Record<ResidualCompany, ImportGradeGrid>; // 잔가 시트 5사 잔가군 그리드
  acqTaxTable: Record<string, { rate: number; evReduction: number }>; // 취득세 B16:F26 (요율·전기감면)
  irrByBrand: Record<string, number>; // 브랜드 B2:C31 운용 IRR (0 이하 = 취급불가)
  lowDepositSurcharge: number; // 브랜드 C34 — 보증금+선수금 11% 미만 금리 가산
  cmFeeRate: number;      // 운용리스 입력 J22 CM수수료율 (배포 기본 2%)
  extraFeeRate: number;   // 운용리스 내부 I27 추가수수료율 (운영기준 공지 1%)
  deliveryFee: number;    // 운용리스 입력 D21 탁송료
  incidentalFee: number;  // 운용리스 입력 D22 부대비
}

/** 잔가 시트 그리드 파싱: 헤더행(잔가군) × 좌측 기간열. 중복 헤더는 첫 열 우선(엑셀 MATCH와 동일). */
function parseGrid(ws: XLSX.WorkSheet, headerR0: number, colStart: number, colEnd: number, termRows: number): ImportGradeGrid {
  const grid: ImportGradeGrid = {};
  for (let c = colStart; c <= colEnd; c++) {
    const grade = str(cell(ws, headerR0, c));
    if (!grade || grid[grade]) continue;
    const byTerm: Record<number, number> = {};
    for (let i = 1; i <= termRows; i++) {
      const months = num(cell(ws, headerR0 + i, 1)); // B열 기간
      const rate = num(cell(ws, headerR0 + i, c));
      if (IMPORT_LEASE_TERMS.includes(months as (typeof IMPORT_LEASE_TERMS)[number]) && rate > 0) byTerm[months] = rate;
    }
    if (Object.keys(byTerm).length > 0) grid[grade] = byTerm;
  }
  return grid;
}

/** 메리츠 수입신차견적 워크북 파싱 → 트림 목록 + 계산 상수. */
export function parseMeritzImportLeaseWorkbook(buf: Buffer | ArrayBuffer): { trims: MeritzImportLeaseTrim[]; consts: MeritzImportLeaseConsts } {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array" });
  const cars = wb.Sheets["차종"];
  const resid = wb.Sheets["잔가"];
  const acq = wb.Sheets["취득세"];
  const brand = wb.Sheets["브랜드"];
  const input = wb.Sheets["운용리스 입력"];
  const inner = wb.Sheets["운용리스 내부"];
  if (!cars || !resid || !acq || !brand || !input || !inner) {
    throw new Error("'차종/잔가/취득세/브랜드/운용리스 입력·내부' 시트를 찾을 수 없습니다. 메리츠 수입신차견적 파일이 맞는지 확인하세요.");
  }

  const trims: MeritzImportLeaseTrim[] = [];
  const last = rows(cars);
  for (let r = 6; r <= last; r++) { // 데이터 row7(r0=6)~
    const manufacturer = str(cell(cars, r, 1)); // B
    const name = str(cell(cars, r, 4));         // E
    if (!manufacturer || !name) continue;
    trims.push({
      manufacturer, name,
      msrp: num(cell(cars, r, 5)),              // F
      disp: num(cell(cars, r, 6)),              // G
      taxClass: str(cell(cars, r, 8)) || "승용", // I
      grades: {
        west: str(cell(cars, r, 9)),  // J
        aj: str(cell(cars, r, 10)),   // K
        aps: str(cell(cars, r, 11)),  // L
        vgs: str(cell(cars, r, 12)),  // M
        self: str(cell(cars, r, 13)), // N
      },
      highResidualBlocked: str(cell(cars, r, 15)) === "고잔가불가", // P
      hiResExtra15k: num(cell(cars, r, 16)),    // Q
      hiResExtra10k: num(cell(cars, r, 17)),    // R
    });
  }

  const grids: Record<ResidualCompany, ImportGradeGrid> = {
    west: parseGrid(resid, 47, 2, 12, 6),  // B48:M54 (12~72개월)
    aj: parseGrid(resid, 56, 2, 23, 5),    // B57:X62
    aps: parseGrid(resid, 64, 2, 22, 5),   // B65:W70
    vgs: parseGrid(resid, 72, 2, 10, 4),   // B73:K77 (24~60)
    self: parseGrid(resid, 79, 2, 4, 4),   // B80:E84
  };

  const acqTaxTable: Record<string, { rate: number; evReduction: number }> = {};
  for (let r = 15; r <= 25; r++) { // 취득세 B16:F26
    const cls = str(cell(acq, r, 1));
    const rate = num(cell(acq, r, 2));
    if (cls && rate > 0) acqTaxTable[cls] = { rate, evReduction: num(cell(acq, r, 4)) };
  }

  const irrByBrand: Record<string, number> = {};
  for (let r = 1; r <= 30; r++) { // 브랜드 B2:C31
    const b = str(cell(brand, r, 1));
    if (b) irrByBrand[b] = num(cell(brand, r, 2)); // 0(엑소틱·미지원) 포함 그대로 기록 → 계산기에서 취급불가 처리
  }

  const consts: MeritzImportLeaseConsts = {
    grids, acqTaxTable, irrByBrand,
    lowDepositSurcharge: num(cell(brand, 33, 2)) || 0.0015, // 브랜드 C34
    cmFeeRate: num(cell(input, 21, 9)),                      // 입력 J22 (배포 기본 2%)
    extraFeeRate: num(cell(inner, 26, 8)) || 0.01,           // 내부 I27 (공지 1%)
    deliveryFee: num(cell(input, 20, 3)),                    // 입력 D21 (배포 기본 100,000)
    incidentalFee: num(cell(input, 21, 3)),                  // 입력 D22 (배포 기본 100,000)
  };
  if (trims.length === 0) throw new Error("차종 시트에서 트림을 찾지 못했습니다.");
  return { trims, consts };
}

/** 메리츠 리스 견적기 워크북 종류 판별 — 국산 신차리스(차량정보+리스수식) vs 수입신차(차종+운용리스 입력). */
export function detectMeritzLeaseVariant(buf: Buffer | ArrayBuffer): "domestic" | "import" | null {
  const wb = XLSX.read(buf, { type: buf instanceof Buffer ? "buffer" : "array", bookSheets: true });
  const names = new Set(wb.SheetNames);
  if (names.has("차량정보") && names.has("리스수식")) return "domestic";
  if (names.has("차종") && names.has("운용리스 입력")) return "import";
  return null;
}
