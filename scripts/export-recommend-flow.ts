/**
 * AI 추천 4단계 플로우의 선택지/추가질문/스코어링 가중치를
 * ~/Desktop/recommend-flow.xlsx 로 내보내는 일회용 스크립트.
 *
 * 실행: npx tsx scripts/export-recommend-flow.ts
 */

import ExcelJS from "exceljs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  INDUSTRY_OPTIONS,
  PURPOSE_OPTIONS,
  BUDGET_RANGE_OPTIONS,
  PAYMENT_STYLE_OPTIONS,
  BUDGET_DETAIL_OPTIONS,
  BUDGET_DETAIL_QUESTION,
  MILEAGE_OPTIONS,
  FUEL_PREFERENCE_OPTIONS,
  INDUSTRY_DETAIL_OPTIONS,
  INDUSTRY_DETAIL_QUESTION,
  PURPOSE_DETAIL_OPTIONS,
  PURPOSE_DETAIL_QUESTION,
} from "../src/constants/recommend-options";

// ── 색상 팔레트 (프로젝트 Primary 기준) ──
const COLOR = {
  headerBg: "FF000666",
  headerFg: "FFFFFFFF",
  veryHigh: "FFC6EFCE",   // 연녹
  high: "FFE2F0D9",       // 더 연한 녹
  medium: "FFFFF2CC",     // 연노랑
  low: "FFFCE4D6",        // 연주황
  none: "FFFFC7CE",       // 연빨강 (제거 후보)
  altRow: "FFF8F9FC",     // 짝수행
};

type Discriminability = "VERY HIGH" | "HIGH" | "MEDIUM" | "LOW" | "NONE" | "—";

interface ScoreRow {
  stage: string;
  condition: string;
  delta: string;
  applied: string;
  discriminability: Discriminability;
  note?: string;
}

const SCORE_ROWS: ScoreRow[] = [
  {
    stage: "기본",
    condition: "모든 차량 (baseline)",
    delta: "+50",
    applied: "초기값",
    discriminability: "—",
  },
  {
    stage: "예산 (메인)",
    condition: "budgetMin ≤ 월납입금 ≤ budgetMax",
    delta: "+30",
    applied: "조건 일치 차량",
    discriminability: "HIGH",
    note: "예산 적합 차량을 결정적으로 상위로 끌어올림",
  },
  {
    stage: "예산 (메인)",
    condition: "월납입금 < budgetMin",
    delta: "+15",
    applied: "조건부",
    discriminability: "MEDIUM",
    note: "예산 미달은 가산 폭이 적음",
  },
  {
    stage: "예산 (메인)",
    condition: "월납입금 > budgetMax",
    delta: "-1점/만원 (최대 -40)",
    applied: "초과액 비례 페널티",
    discriminability: "HIGH",
    note: "예산 초과 강력 페널티",
  },
  {
    stage: "업종 × 목적",
    condition: "recConfig.scoreMatrix[업종][목적]",
    delta: "+matrix/10",
    applied: "차량별 추천설정 행렬",
    discriminability: "HIGH",
    note: "DB에 저장된 업종×목적 행렬에 의존. 행렬 미설정 시 0",
  },
  {
    stage: "차량 (인기)",
    condition: "v.isPopular === true",
    delta: "+5",
    applied: "인기차량 플래그",
    discriminability: "MEDIUM",
  },
  {
    stage: "업종 추가",
    condition: "법인 × 6대 이상 + non-SUV",
    delta: "+5",
    applied: "조건부",
    discriminability: "LOW",
    note: "법인+6대이상이라는 좁은 분기에서만 적용",
  },
  {
    stage: "업종 추가",
    condition: "개인사업자 × 비용처리 중요",
    delta: "+3",
    applied: "조건 일치 시 모든 차량 동등",
    discriminability: "NONE",
    note: "⚠️ 모든 차량에 +3 동등 가산 → 정렬에 영향 없음. 질문 제거 후보",
  },
  {
    stage: "업종 추가",
    condition: "직장인 × 자가용 주요 + 연비 > 12",
    delta: "+5",
    applied: "고연비 차량 가산",
    discriminability: "MEDIUM",
  },
  {
    stage: "업종 추가",
    condition: "개인 × 4명 이상 + SUV/대형",
    delta: "+8",
    applied: "차종 매칭",
    discriminability: "HIGH",
  },
  {
    stage: "목적 추가",
    condition: "출퇴근 × 30km 이상 + 연비 > 14",
    delta: "+5",
    applied: "고연비 차량 가산",
    discriminability: "MEDIUM",
  },
  {
    stage: "목적 추가",
    condition: "영업·외근 × 매일",
    delta: "+5",
    applied: "조건 일치 시 모든 차량 동등",
    discriminability: "NONE",
    note: "⚠️ 모든 차량에 +5 동등 가산 → 정렬에 영향 없음. 질문 제거 후보",
  },
  {
    stage: "목적 추가",
    condition: "가족 × 영유아 + SUV",
    delta: "+8",
    applied: "차종 매칭",
    discriminability: "HIGH",
  },
  {
    stage: "목적 추가",
    condition: "화물·배달 × 대형 화물",
    delta: "+10 (밴/트럭) 또는 -10 (그 외)",
    applied: "양음 양방향",
    discriminability: "VERY HIGH",
    note: "변별력 최상. 차종 정확히 분리",
  },
  {
    stage: "목적 추가",
    condition: "기타 × 평일 포함 자주 + 연비 > 12",
    delta: "+3",
    applied: "고연비 차량 가산",
    discriminability: "LOW",
  },
  {
    stage: "목적 추가",
    condition: "의전·임원 × 기사 운행 + 대형/세단",
    delta: "+10",
    applied: "차종 매칭",
    discriminability: "HIGH",
  },
  {
    stage: "예산 추가",
    condition: "조금 타협 가능 (예산 +10%)",
    delta: "필터 완화 (×1.1)",
    applied: "예산 상한 확장",
    discriminability: "MEDIUM",
    note: "필터 통과 차량 풀이 늘어남",
  },
  {
    stage: "예산 추가",
    condition: "월납이 타협된 상한 이내일 때",
    delta: "+10",
    applied: "조건부",
    discriminability: "MEDIUM",
  },
  {
    stage: "예산 추가",
    condition: "300만원 이상 × 공격형 + 차량가 > 4천만원",
    delta: "+5",
    applied: "고가 차량 가산",
    discriminability: "LOW",
  },
  {
    stage: "성향 (의전)",
    condition: "의전·임원용 + 대형/세단/프리미엄",
    delta: "+15",
    applied: "차종 매칭",
    discriminability: "VERY HIGH",
  },
  {
    stage: "성향 (의전)",
    condition: "의전·임원용 + SUV",
    delta: "+8",
    applied: "차종 매칭",
    discriminability: "HIGH",
  },
  {
    stage: "성향 (의전)",
    condition: "의전·임원용 + 경차/소형/밴/트럭",
    delta: "-15",
    applied: "차종 페널티",
    discriminability: "VERY HIGH",
  },
  {
    stage: "성향 (연료)",
    condition: "전기차 선호 + 트림.fuelType=전기",
    delta: "+15",
    applied: "연료 매칭",
    discriminability: "VERY HIGH",
  },
  {
    stage: "성향 (연료)",
    condition: "하이브리드 선호 + 트림.fuelType=하이브리드",
    delta: "+15",
    applied: "연료 매칭",
    discriminability: "VERY HIGH",
  },
  {
    stage: "성향 (연료)",
    condition: "가솔린/디젤 선호 + 매칭",
    delta: "+5",
    applied: "연료 매칭",
    discriminability: "MEDIUM",
  },
  {
    stage: "성향 (연료)",
    condition: "선호 ≠ 상관없음 + 미매칭",
    delta: "-5",
    applied: "연료 페널티",
    discriminability: "MEDIUM",
  },
  {
    stage: "추천 이유 보너스",
    condition: "출퇴근 + 연비 > 14",
    delta: "+3",
    applied: "조건부",
    discriminability: "LOW",
  },
  {
    stage: "추천 이유 보너스",
    condition: "가족 + SUV",
    delta: "+5",
    applied: "차종 매칭",
    discriminability: "MEDIUM",
  },
  {
    stage: "추천 이유 보너스",
    condition: "화물·배달 + 밴/트럭",
    delta: "+5",
    applied: "차종 매칭",
    discriminability: "MEDIUM",
  },
];

function discriminabilityColor(level: Discriminability): string | null {
  switch (level) {
    case "VERY HIGH": return COLOR.veryHigh;
    case "HIGH": return COLOR.high;
    case "MEDIUM": return COLOR.medium;
    case "LOW": return COLOR.low;
    case "NONE": return COLOR.none;
    default: return null;
  }
}

function styleHeader(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLOR.headerFg }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR.headerBg },
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000666" } },
      left: { style: "thin", color: { argb: "FFE0E4F0" } },
      right: { style: "thin", color: { argb: "FFE0E4F0" } },
      bottom: { style: "thin", color: { argb: "FF000666" } },
    };
  });
  row.height = 28;
}

function autoFitColumns(sheet: ExcelJS.Worksheet, maxWidths: number[]): void {
  sheet.columns.forEach((col, idx) => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const txt = cell.value == null ? "" : String(cell.value);
      // 한글 문자 폭 보정 (대략 2배)
      const visualLen = [...txt].reduce(
        (sum, ch) => sum + (/[가-힯一-鿿]/.test(ch) ? 2 : 1),
        0,
      );
      if (visualLen > maxLen) maxLen = visualLen;
    });
    const cap = maxWidths[idx] ?? 60;
    col.width = Math.min(maxLen + 2, cap);
  });
}

function zebra(sheet: ExcelJS.Worksheet, startRow: number): void {
  for (let i = startRow; i <= sheet.rowCount; i++) {
    if ((i - startRow) % 2 === 1) {
      sheet.getRow(i).eachCell((cell) => {
        if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor === undefined) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLOR.altRow },
          };
        }
      });
    }
  }
}

// ── 시트 1: 1단계 업종 ──
function buildIndustrySheet(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet("1단계_업종");
  sheet.addRow(["업종", "설명", "추가 질문", "추가질문 답변", "답변 설명"]);
  styleHeader(sheet.getRow(1));

  for (const opt of INDUSTRY_OPTIONS) {
    const detailQ = INDUSTRY_DETAIL_QUESTION[opt.value];
    const details = INDUSTRY_DETAIL_OPTIONS[opt.value] ?? [];
    if (details.length === 0) {
      sheet.addRow([
        `${opt.icon} ${opt.label}`,
        opt.desc,
        detailQ?.title ?? "—",
        "—",
        "—",
      ]);
      continue;
    }
    details.forEach((d, idx) => {
      sheet.addRow([
        idx === 0 ? `${opt.icon} ${opt.label}` : "",
        idx === 0 ? opt.desc : "",
        idx === 0 ? detailQ?.title ?? "—" : "",
        `${d.icon ?? ""} ${d.label}`.trim(),
        d.desc ?? "—",
      ]);
    });
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(sheet, [22, 40, 36, 32, 50]);
  zebra(sheet, 2);
}

// ── 시트 2: 2단계 목적 ──
function buildPurposeSheet(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet("2단계_목적");
  sheet.addRow(["목적", "설명", "추가 질문", "추가질문 답변", "답변 설명"]);
  styleHeader(sheet.getRow(1));

  for (const opt of PURPOSE_OPTIONS) {
    const detailQ = PURPOSE_DETAIL_QUESTION[opt.value];
    const details = PURPOSE_DETAIL_OPTIONS[opt.value] ?? [];
    if (details.length === 0) {
      sheet.addRow([
        `${opt.icon} ${opt.label}`,
        opt.desc,
        detailQ?.title ?? "—",
        "—",
        "—",
      ]);
      continue;
    }
    details.forEach((d, idx) => {
      sheet.addRow([
        idx === 0 ? `${opt.icon} ${opt.label}` : "",
        idx === 0 ? opt.desc : "",
        idx === 0 ? detailQ?.title ?? "—" : "",
        `${d.icon ?? ""} ${d.label}`.trim(),
        d.desc ?? "—",
      ]);
    });
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(sheet, [22, 40, 36, 32, 50]);
  zebra(sheet, 2);
}

// ── 시트 3: 3단계 예산 ──
function buildBudgetSheet(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet("3단계_예산");

  sheet.addRow(["[A] 예산 구간"]).font = { bold: true, size: 12 };
  const r1 = sheet.addRow(["구간 키", "라벨", "최소 (원)", "최대 (원)"]);
  styleHeader(r1);
  for (const b of BUDGET_RANGE_OPTIONS) {
    sheet.addRow([b.value, b.label, b.budgetMin, b.budgetMax]);
  }

  sheet.addRow([]);
  sheet.addRow(["[B] 납입 방식"]).font = { bold: true, size: 12 };
  const r2 = sheet.addRow(["방식", "라벨", "요약 설명", "상세 설명", "추천 기본"]);
  styleHeader(r2);
  for (const p of PAYMENT_STYLE_OPTIONS) {
    sheet.addRow([
      p.value,
      p.label,
      p.desc,
      p.detail,
      "recommended" in p && p.recommended ? "✓" : "",
    ]);
  }

  sheet.addRow([]);
  sheet.addRow(["[C] 납입 방식별 추가 질문"]).font = { bold: true, size: 12 };
  const r3 = sheet.addRow(["납입 방식", "추가 질문", "답변", "답변 설명"]);
  styleHeader(r3);
  for (const style of Object.keys(BUDGET_DETAIL_OPTIONS)) {
    const q = BUDGET_DETAIL_QUESTION[style];
    const opts = BUDGET_DETAIL_OPTIONS[style];
    opts.forEach((d, idx) => {
      sheet.addRow([
        idx === 0 ? style : "",
        idx === 0 ? q?.title ?? "—" : "",
        `${d.icon ?? ""} ${d.label}`.trim(),
        d.desc ?? "—",
      ]);
    });
  }

  autoFitColumns(sheet, [18, 30, 40, 50, 14]);
}

// ── 시트 4: 4단계 성향 ──
function buildPreferenceSheet(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet("4단계_성향");

  sheet.addRow(["[A] 연간 주행거리"]).font = { bold: true, size: 12 };
  const r1 = sheet.addRow(["값 (km)", "라벨", "설명"]);
  styleHeader(r1);
  for (const m of MILEAGE_OPTIONS) {
    sheet.addRow([m.value, m.label, m.desc]);
  }

  sheet.addRow([]);
  sheet.addRow(["[B] 연료 선호"]).font = { bold: true, size: 12 };
  const r3 = sheet.addRow(["값", "라벨", "설명"]);
  styleHeader(r3);
  for (const f of FUEL_PREFERENCE_OPTIONS) {
    sheet.addRow([f.value, `${f.icon ?? ""} ${f.label}`.trim(), f.desc]);
  }

  autoFitColumns(sheet, [18, 28, 50, 50]);
}

// ── 시트 5: 스코어링 가중치 (분석 핵심) ──
function buildScoringSheet(wb: ExcelJS.Workbook): void {
  const sheet = wb.addWorksheet("스코어링_가중치");

  sheet.addRow([
    "질문 단계",
    "조건 (입력값)",
    "점수 영향 (Δ)",
    "적용 방식",
    "변별력",
    "비고",
  ]);
  styleHeader(sheet.getRow(1));

  for (const r of SCORE_ROWS) {
    const row = sheet.addRow([
      r.stage,
      r.condition,
      r.delta,
      r.applied,
      r.discriminability,
      r.note ?? "",
    ]);
    const color = discriminabilityColor(r.discriminability);
    if (color) {
      row.getCell(5).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: color },
      };
      row.getCell(5).font = { bold: true };
    }
    if (r.discriminability === "NONE") {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR.none },
        };
      });
    }
  }

  // 분석 메모 영역
  sheet.addRow([]);
  sheet.addRow([]);
  const memoTitle = sheet.addRow(["📊 분석 메모"]);
  memoTitle.getCell(1).font = { bold: true, size: 13, color: { argb: "FF000666" } };

  const memos = [
    "1. 변별력 NONE 행은 답변에 따라 추천 차량 점수에 차이를 만들지 못합니다 → 질문 제거 또는 가중치 재설계 후보입니다.",
    "   - 개인사업자 × 비용처리 중요 (+3, 모든 차량 동등)",
    "   - 영업·외근 × 매일 (+5, 모든 차량 동등)",
    "",
    "2. 변별력 VERY HIGH (±15 이상) 항목이 추천 결과를 좌우합니다 → 이 질문들의 UX·답변 옵션 정확도를 최우선으로 점검하세요.",
    "   - 화물·배달 × 대형 화물 (+10/-10 양방향)",
    "   - 의전·임원용 × 차종 매칭 (+15/+8/-15)",
    "   - 연료 선호 × 트림 매칭 (+15/-5)",
    "",
    "3. 업종 (메인) 점수는 DB의 recConfig.scoreMatrix 행렬에 의존합니다 → 행렬이 비어 있으면 업종/목적 메인 질문이 무력화됩니다. 차량별 행렬 데이터 점검 필요.",
    "",
    "4. 예산 (메인)은 30점·페널티-40점으로 가장 큰 단일 가중치 → 사용자가 예산을 잘못 입력하면 추천 품질 직접 하락. 예산 입력 UX 정확도가 최우선.",
    "",
    "5. LOW 분류 항목(법인×6대이상×non-SUV, 300만원이상×공격형 등)은 적용 분기가 매우 좁아 실제 영향이 미미합니다 → 단순화 검토.",
    "",
    "6. 색상 가이드: 🟩 VERY HIGH/HIGH (유지) · 🟨 MEDIUM (관찰) · 🟧 LOW (단순화 검토) · 🟥 NONE (제거 후보)",
  ];
  for (const m of memos) {
    sheet.addRow([m]);
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  autoFitColumns(sheet, [16, 40, 24, 30, 14, 60]);
}

async function main(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "im_dealer / export-recommend-flow";
  wb.created = new Date();

  buildIndustrySheet(wb);
  buildPurposeSheet(wb);
  buildBudgetSheet(wb);
  buildPreferenceSheet(wb);
  buildScoringSheet(wb);

  const outputPath = join(homedir(), "Desktop", "recommend-flow.xlsx");
  await wb.xlsx.writeFile(outputPath);
  // eslint-disable-next-line no-console
  console.log(`✅ 엑셀 생성 완료: ${outputPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ 엑셀 생성 실패:", err);
  process.exit(1);
});
