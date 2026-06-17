import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { QuoteScenarioDetail } from "@/types/quote";
import type { PDFQuoteData, PDFQuoteColor } from "@/lib/quote-pdf-template";

// ── 포맷 헬퍼 ─────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";
const fmtMonthly = (n: number) => `월 ${n.toLocaleString("ko-KR")}원`;

function formatDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}. ${m}. ${day}`;
}
function formatExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return formatDate(d);
}
function generateQuoteNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${dateStr}-${rand}`;
}

// ── 색상 토큰 ─────────────────────────────────────────────
const C = {
  primary: "#000666",
  accent: "#6066EE",
  border: "#E0E2EE",
  bg: "#F8F9FC",
  text: "#1A1A2E",
  muted: "#9BA4C0",
  red: "#D93025",
  highlight: "#EEEEFA",
  thText: "#5A607A",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 9,
    color: C.text,
    paddingVertical: 30,
    paddingHorizontal: 34,
    lineHeight: 1.5,
  },
  // 헤더
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
    paddingBottom: 12,
    marginBottom: 18,
  },
  brand: { fontSize: 18, fontWeight: 700, color: C.primary, letterSpacing: -0.5 },
  brandSub: { fontSize: 8.5, color: C.muted, marginTop: 3 },
  quoteMeta: { alignItems: "flex-end" },
  quoteNo: { fontSize: 9.5, fontWeight: 600, color: C.primary, marginBottom: 2 },
  metaLine: { fontSize: 8.5, color: C.muted, marginBottom: 1 },
  // 섹션
  section: { marginBottom: 14 },
  secTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    color: C.primary,
    letterSpacing: 0.5,
    paddingLeft: 7,
    borderLeftWidth: 2.5,
    borderLeftColor: C.accent,
    marginBottom: 7,
  },
  // 테이블 공통 (단일 보더: 상/좌는 테이블, 우/하는 셀)
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: C.border },
  row: { flexDirection: "row" },
  th: {
    backgroundColor: C.bg,
    color: C.thText,
    fontWeight: 500,
    fontSize: 9,
    padding: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
  },
  td: {
    fontSize: 9,
    color: C.text,
    padding: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    justifyContent: "center",
  },
  tdBold: { fontWeight: 700, color: C.primary },
  // 시나리오 테이블
  scThead: {
    padding: 7,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    alignItems: "center",
  },
  scTheadHi: { backgroundColor: C.primary },
  thLabel: { fontSize: 9.5, fontWeight: 700, color: C.text },
  thLabelHi: { color: "#fff" },
  thDesc: { fontSize: 7.5, color: C.muted, marginTop: 2, textAlign: "center" },
  thDescHi: { color: "rgba(255,255,255,0.7)" },
  scCell: {
    padding: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  scCellHi: { backgroundColor: C.highlight },
  cellMonthly: { fontSize: 11, fontWeight: 700, color: C.text },
  cellMonthlyHi: { fontSize: 12.5, color: C.primary },
  cellSub: { fontSize: 7.5, color: C.muted, marginTop: 2, textAlign: "center" },
  cellSubRed: { color: C.red },
  cellFinance: { fontSize: 7.5, color: C.accent, fontWeight: 500, marginTop: 3 },
  // 결과 박스
  resultBox: {
    backgroundColor: C.highlight,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 6,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resLabel: { fontSize: 11, fontWeight: 700, color: C.primary },
  resSub: { fontSize: 7.5, color: C.muted, marginTop: 3, lineHeight: 1.6 },
  resValue: { fontSize: 16, fontWeight: 700, color: C.red, textAlign: "right" },
  resValueSub: { fontSize: 7.5, color: C.muted, textAlign: "right", marginTop: 2 },
  // 유의사항
  notice: {
    backgroundColor: "#FFF9F9",
    borderWidth: 1,
    borderColor: "#FDE0E0",
    borderRadius: 5,
    padding: 11,
    marginTop: 14,
  },
  noticeTitle: { fontSize: 9, fontWeight: 700, color: C.red, marginBottom: 6 },
  noticeItem: { flexDirection: "row", marginBottom: 3 },
  bullet: { fontSize: 8, color: C.red, width: 9 },
  noticeText: { fontSize: 8, color: "#666", flex: 1, lineHeight: 1.5 },
  // 푸터
  footer: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerL: { fontSize: 8, color: C.muted, lineHeight: 1.7 },
  footerR: { alignItems: "flex-end" },
  footerBrand: { fontSize: 9.5, fontWeight: 700, color: C.primary },
  footerNote: { fontSize: 8, color: C.muted, marginTop: 1 },
  // 색상 칩
  colorRowInner: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  chip: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: "#D8DAE6", marginRight: 4 },
  cMuted: { color: C.muted },
});

function ScenarioCell({ sc, hi }: { sc: QuoteScenarioDetail; hi: boolean }) {
  const noInitial = sc.depositAmount === 0 && sc.prepayAmount === 0;
  return (
    <View style={[s.scCell, hi ? s.scCellHi : {}]}>
      <Text style={[s.cellMonthly, hi ? s.cellMonthlyHi : {}]}>{fmtMonthly(sc.monthlyPayment)}</Text>
      {sc.depositAmount > 0 && <Text style={s.cellSub}>보증금 {fmt(sc.depositAmount)}</Text>}
      {sc.prepayAmount > 0 && <Text style={s.cellSub}>선납금 {fmt(sc.prepayAmount)}</Text>}
      {noInitial && <Text style={s.cellSub}>초기비용 없음</Text>}
      <Text style={s.cellFinance}>{sc.bestFinanceCompany}</Text>
      {sc.purchaseSurcharge > 0 && (
        <Text style={[s.cellSub, s.cellSubRed]}>인수형 +{fmt(sc.purchaseSurcharge)}</Text>
      )}
    </View>
  );
}

function ColorLine({ label, c }: { label: string; c: PDFQuoteColor | null | undefined }) {
  if (!c) return null;
  return (
    <View style={s.colorRowInner}>
      <Text style={s.cMuted}>{label}</Text>
      <View style={[s.chip, { backgroundColor: c.hexCode }]} />
      <Text>{c.name}</Text>
      {c.priceDelta > 0 && <Text style={s.cMuted}> (+{fmt(c.priceDelta)})</Text>}
    </View>
  );
}

export function QuoteDocument({ data }: { data: PDFQuoteData }) {
  const quoteNumber = generateQuoteNumber();
  const today = formatDate();
  const expiry = formatExpiryDate();
  const mileageLabel = `연 ${(data.annualMileage / 10000).toFixed(0)}만km`;
  const { conservative, standard, aggressive } = data.scenarios;
  const isProductRent = data.productType === "장기렌트";
  const hasColor = !!(data.exteriorColor || data.interiorColor);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* 헤더 */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>IM DEALER</Text>
            <Text style={s.brandSub}>아임딜러 장기렌트/리스 공식 견적서</Text>
          </View>
          <View style={s.quoteMeta}>
            <Text style={s.quoteNo}>견적번호: {quoteNumber}</Text>
            <Text style={s.metaLine}>산출일: {today}</Text>
            <Text style={s.metaLine}>유효기간: {expiry} 까지</Text>
          </View>
        </View>

        {/* 1. 차량 기본 정보 */}
        <View style={s.section}>
          <Text style={s.secTitle}>1. 차량 기본 정보</Text>
          <View style={s.table}>
            <View style={s.row}>
              <Text style={[s.th, { width: "22%" }]}>제조사 및 차종</Text>
              <Text style={[s.td, { width: "28%" }]}>{data.vehicleBrand} {data.vehicleName}</Text>
              <Text style={[s.th, { width: "22%" }]}>상세 트림명</Text>
              <Text style={[s.td, { width: "28%" }]}>{data.trimName}</Text>
            </View>
            <View style={s.row}>
              <Text style={[s.th, { width: "22%" }]}>선택 옵션</Text>
              <View style={[s.td, { width: "78%" }]}>
                {data.selectedOptions.length > 0 ? (
                  <Text>
                    {data.selectedOptions.map((o, i) => (
                      <Text key={i}>
                        {i > 0 ? "  ·  " : ""}{o.name}
                        <Text style={s.cMuted}> ({fmt(o.price)})</Text>
                      </Text>
                    ))}
                  </Text>
                ) : (
                  <Text style={s.cMuted}>선택 옵션 없음</Text>
                )}
              </View>
            </View>
            {hasColor && (
              <View style={s.row}>
                <Text style={[s.th, { width: "22%" }]}>색상 선택</Text>
                <View style={[s.td, { width: "78%" }]}>
                  <ColorLine label="외장:" c={data.exteriorColor} />
                  <ColorLine label="내장:" c={data.interiorColor} />
                </View>
              </View>
            )}
            <View style={s.row}>
              <Text style={[s.th, { width: "22%" }]}>트림 기본가</Text>
              <Text style={[s.td, { width: "28%" }]}>{fmt(data.trimPrice)}</Text>
              <Text style={[s.th, { width: "22%" }]}>총 차량 가격</Text>
              <Text style={[s.td, s.tdBold, { width: "28%" }]}>{fmt(data.totalVehiclePrice)}</Text>
            </View>
          </View>
        </View>

        {/* 2. 계약 조건 */}
        <View style={s.section}>
          <Text style={s.secTitle}>2. 계약 조건</Text>
          <View style={s.table}>
            <View style={s.row}>
              <Text style={[s.th, { width: "22%" }]}>상품 유형</Text>
              <Text style={[s.td, { width: "28%" }]}>{data.productType}</Text>
              <Text style={[s.th, { width: "22%" }]}>계약 종류</Text>
              <Text style={[s.td, { width: "28%" }]}>{data.contractType}</Text>
            </View>
            <View style={s.row}>
              <Text style={[s.th, { width: "22%" }]}>계약 기간</Text>
              <Text style={[s.td, { width: "28%" }]}>{data.contractMonths}개월</Text>
              <Text style={[s.th, { width: "22%" }]}>약정 주행거리</Text>
              <Text style={[s.td, { width: "28%" }]}>{mileageLabel}</Text>
            </View>
          </View>
        </View>

        {/* 3. 시나리오별 견적 비교 */}
        <View style={s.section}>
          <Text style={s.secTitle}>3. 시나리오별 견적 비교</Text>
          <View style={s.table}>
            {/* thead */}
            <View style={s.row}>
              <View style={[s.scThead, { width: "20%" }]} />
              <View style={[s.scThead, { width: "26.66%" }]}>
                <Text style={s.thLabel}>보증금</Text>
                <Text style={s.thDesc}>보증금 20% · 월납입 절약</Text>
              </View>
              <View style={[s.scThead, s.scTheadHi, { width: "26.66%" }]}>
                <Text style={[s.thLabel, s.thLabelHi]}>무보증 ★</Text>
                <Text style={[s.thDesc, s.thDescHi]}>초기비용 없음 · 기본 추천</Text>
              </View>
              <View style={[s.scThead, { width: "26.68%" }]}>
                <Text style={s.thLabel}>선납금</Text>
                <Text style={s.thDesc}>선납금 30% · 월납입 최소</Text>
              </View>
            </View>
            {/* 월 납입금 */}
            <View style={s.row}>
              <Text style={[s.th, { width: "20%" }]}>월 납입금</Text>
              <View style={{ width: "26.66%" }}><ScenarioCell sc={conservative} hi={false} /></View>
              <View style={{ width: "26.66%" }}><ScenarioCell sc={standard} hi /></View>
              <View style={{ width: "26.68%" }}><ScenarioCell sc={aggressive} hi={false} /></View>
            </View>
            {/* 최우선 금융사 */}
            <View style={s.row}>
              <Text style={[s.th, { width: "20%" }]}>최우선 금융사</Text>
              <Text style={[s.td, { width: "26.66%", textAlign: "center" }]}>{conservative.bestFinanceCompany}</Text>
              <Text style={[s.td, s.scCellHi, { width: "26.66%", textAlign: "center", fontWeight: 600, color: C.primary }]}>{standard.bestFinanceCompany}</Text>
              <Text style={[s.td, { width: "26.68%", textAlign: "center" }]}>{aggressive.bestFinanceCompany}</Text>
            </View>
          </View>
        </View>

        {/* 4. 기본 추천 견적 (무보증) */}
        <View style={s.section}>
          <Text style={s.secTitle}>4. 기본 추천 견적 (무보증)</Text>
          <View style={s.resultBox}>
            <View>
              <Text style={s.resLabel}>최종 월 납입금</Text>
              <Text style={s.resSub}>
                금융사: {standard.bestFinanceCompany} · 아임딜러 최저가 매칭
                {standard.purchaseSurcharge > 0 ? `\n인수형 가산: +${fmt(standard.purchaseSurcharge)} 포함` : ""}
              </Text>
            </View>
            <View>
              <Text style={s.resValue}>{fmtMonthly(standard.monthlyPayment)}</Text>
              {isProductRent && <Text style={s.resValueSub}>취등록세 · 자동차세 · 보험료 포함</Text>}
            </View>
          </View>
        </View>

        {/* 유의사항 */}
        <View style={s.notice}>
          <Text style={s.noticeTitle}>⚠ 유의사항 고지</Text>
          {[
            "본 견적은 산출일 기준이며, 금융사 금리 변동 및 제조사 차량 가격 인상 등에 따라 실제 계약 시 금액이 변동될 수 있습니다.",
            "차량 출고 시점에 따라 보조금 및 세제혜택이 변동될 수 있습니다.",
            `유효기간(${expiry}) 경과 후에는 새로운 견적 산출이 필요합니다.`,
            ...(isProductRent
              ? ["장기렌트의 경우 취득세, 자동차세, 의무보험료가 월 납입금에 포함되어 있습니다."]
              : []),
          ].map((t, i) => (
            <View key={i} style={s.noticeItem}>
              <Text style={s.bullet}>•</Text>
              <Text style={s.noticeText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* 푸터 */}
        <View style={s.footer}>
          <View style={s.footerL}>
            <Text>고객 이메일: {data.userEmail}</Text>
            <Text>산출일: {today}  |  유효기간: {expiry} 까지</Text>
          </View>
          <View style={s.footerR}>
            <Text style={s.footerBrand}>IM DEALER</Text>
            <Text style={s.footerNote}>본 견적서는 아임딜러 시스템에 의해 자동 생성되었습니다.</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
