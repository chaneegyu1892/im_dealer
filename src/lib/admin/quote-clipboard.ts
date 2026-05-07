import type { AdminSavedQuote } from "@/types/admin";

function formatRateLine(quote: Pick<AdminSavedQuote, "depositRate" | "prepayRate">): string {
  if (quote.depositRate > 0) return `보증금 ${quote.depositRate}%`;
  if (quote.prepayRate > 0) return `선납금 ${quote.prepayRate}%`;
  return "보증금/선납금 없음";
}

export function formatQuoteForClipboard(quote: AdminSavedQuote): string {
  const trimLine = [quote.vehicleBrand, quote.vehicleName, quote.trimName]
    .filter((v) => v && v.length > 0)
    .join(" · ");

  const conditionLine = [
    `${quote.contractMonths}개월`,
    `연 ${quote.annualMileage.toLocaleString("ko-KR")}km`,
    formatRateLine(quote),
  ].join(" / ");

  const colorLines: string[] = [];
  if (quote.exteriorColorName) colorLines.push(`외장: ${quote.exteriorColorName}`);
  if (quote.interiorColorName) colorLines.push(`내장: ${quote.interiorColorName}`);

  const lines = [
    "[아임딜러 견적]",
    trimLine,
    conditionLine,
    ...colorLines,
    "",
    `월 납입금  ${quote.monthlyPayment.toLocaleString("ko-KR")}원`,
    `총 비용     ${quote.totalCost.toLocaleString("ko-KR")}원`,
  ];

  return lines.join("\n");
}
