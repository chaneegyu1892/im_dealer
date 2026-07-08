import type { CSSProperties } from "react";
import type { QuoteDocumentColor } from "@/lib/quote-document-template";

export const C = {
  primary: "#000666",
  accent: "#6066EE",
  border: "#E0E2EE",
  bg: "#F8F9FC",
  text: "#1A1A2E",
  muted: "#7C849C",
  red: "#D93025",
  highlight: "#EEEEFA",
  noticeBg: "#FFF9F9",
  noticeBorder: "#FDE0E0",
} as const;

export const INSURANCE_TERMS: readonly { readonly label: string; readonly value: string }[] = [
  { label: "운전 연령/범위", value: "만 26세 이상 / 누구나 운전 가능" },
  { label: "대인 배상", value: "무한" },
  { label: "대물 배상", value: "1억 원" },
  { label: "자손/자상", value: "자기신체사고 1억 원" },
  { label: "자차 면책금", value: "건당 30만 / 50만 원" },
  { label: "무보험차 상해", value: "2억 원" },
];

export const fmt = (n: number) => `${n.toLocaleString("ko-KR")}원`;
export const fmtMonthly = (n: number) => `월 ${n.toLocaleString("ko-KR")}원`;

export function formatDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}. ${m}. ${day}`;
}

export function formatExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return formatDate(d);
}

export function generateQuoteNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${dateStr}-${rand}`;
}

export function formatColor(c: QuoteDocumentColor): string {
  const delta = c.priceDelta > 0 ? ` (+${fmt(c.priceDelta)})` : "";
  return `${c.name}${delta}`;
}

export const st = {
  page: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    color: C.text,
    fontFamily: "Pretendard",
    padding: 68,
  },
  header: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: `4px solid ${C.primary}`,
    paddingBottom: 22,
    marginBottom: 26,
  },
  brandBlock: { display: "flex", flexDirection: "column" },
  brandLogo: { width: 188, height: 46, objectFit: "contain" },
  brandText: { fontSize: 38, fontWeight: 800, color: C.primary },
  brandSub: { marginTop: 12, fontSize: 18, color: C.muted },
  meta: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  quoteNo: { fontSize: 20, fontWeight: 700, color: C.primary, marginBottom: 8 },
  metaLine: { fontSize: 17, color: C.muted, marginTop: 3 },
  section: { display: "flex", flexDirection: "column", marginBottom: 22 },
  sectionTitle: {
    display: "flex",
    flexDirection: "row",
    fontSize: 19,
    fontWeight: 800,
    color: C.primary,
    borderLeft: `6px solid ${C.accent}`,
    paddingLeft: 14,
    marginBottom: 11,
  },
  table: { display: "flex", flexDirection: "column", borderTop: `2px solid ${C.border}`, borderLeft: `2px solid ${C.border}` },
  row: { display: "flex", flexDirection: "row", width: "100%" },
  th: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    color: "#5A607A",
    fontSize: 17,
    fontWeight: 700,
    padding: "11px 10px",
    borderRight: `2px solid ${C.border}`,
    borderBottom: `2px solid ${C.border}`,
  },
  td: {
    display: "flex",
    alignItems: "center",
    color: C.text,
    fontSize: 17,
    fontWeight: 500,
    padding: "11px 12px",
    borderRight: `2px solid ${C.border}`,
    borderBottom: `2px solid ${C.border}`,
  },
  tdBold: { fontWeight: 800, color: C.primary },
  scenarioHead: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.bg,
    padding: "15px 8px",
    borderRight: `2px solid ${C.border}`,
    borderBottom: `2px solid ${C.border}`,
  },
  scenarioHeadHi: { backgroundColor: C.primary, color: "#FFFFFF" },
  scenarioCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 112,
    padding: 12,
    borderRight: `2px solid ${C.border}`,
    borderBottom: `2px solid ${C.border}`,
  },
  scenarioCellHi: { backgroundColor: C.highlight },
  monthly: { fontSize: 23, fontWeight: 800, color: C.text },
  monthlyHi: { fontSize: 27, color: C.primary },
  small: { marginTop: 6, fontSize: 15, color: C.muted },
  smallRed: { color: C.red },
  financeName: { marginTop: 8, fontSize: 15, fontWeight: 700, color: C.accent },
  resultBox: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.highlight,
    border: `3px solid ${C.primary}`,
    borderRadius: 12,
    padding: "22px 24px",
  },
  resultLeft: { display: "flex", flexDirection: "column" },
  resultLabel: { fontSize: 24, fontWeight: 800, color: C.primary },
  resultSub: { marginTop: 9, fontSize: 16, color: C.muted },
  resultRight: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  resultValue: { fontSize: 36, fontWeight: 800, color: C.red },
  notice: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: C.noticeBg,
    border: `2px solid ${C.noticeBorder}`,
    borderRadius: 10,
    padding: 18,
    marginTop: 2,
  },
  noticeTitle: { fontSize: 19, fontWeight: 800, color: C.red, marginBottom: 9 },
  noticeItem: { display: "flex", flexDirection: "row", marginTop: 4 },
  bullet: { width: 18, fontSize: 16, color: C.red },
  noticeText: { flex: 1, fontSize: 15, color: "#555B6B", lineHeight: 1.5 },
  footer: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTop: `2px solid ${C.border}`,
    paddingTop: 16,
    marginTop: "auto",
  },
  footerLeft: { display: "flex", flexDirection: "column", fontSize: 15, color: C.muted },
  footerRight: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  footerLogo: { width: 106, height: 26, objectFit: "contain" },
  footerBrand: { fontSize: 20, fontWeight: 800, color: C.primary },
  footerNote: { marginTop: 5, fontSize: 15, color: C.muted },
  financeRow: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  financeLogo: { width: 32, height: 22, objectFit: "contain", marginRight: 7 },
  colorRow: { display: "flex", flexDirection: "row", alignItems: "center", marginRight: 24 },
  chip: { width: 18, height: 18, borderRadius: 9, border: "2px solid #D8DAE6", marginRight: 8 },
} satisfies Record<string, CSSProperties>;
