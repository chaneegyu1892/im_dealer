import type { QuoteScenarioDetails, QuoteScenarioDetail } from "@/types/quote";

export interface PDFQuoteData {
  vehicleName: string;
  vehicleBrand: string;
  trimName: string;
  trimPrice: number;
  selectedOptions: Array<{ name: string; price: number }>;
  totalVehiclePrice: number;
  productType: string;
  contractMonths: number;
  annualMileage: number;
  contractType: string;
  scenarios: QuoteScenarioDetails;
  userEmail: string;
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

function fmtMonthly(n: number): string {
  return `월 ${n.toLocaleString("ko-KR")}원`;
}

function generateQuoteNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${dateStr}-${rand}`;
}

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

function scenarioCell(scenario: QuoteScenarioDetail, isHighlight: boolean): string {
  const depositLine =
    scenario.depositAmount > 0
      ? `<div class="cell-sub">보증금 ${fmt(scenario.depositAmount)}</div>`
      : "";
  const prepayLine =
    scenario.prepayAmount > 0
      ? `<div class="cell-sub">선납금 ${fmt(scenario.prepayAmount)}</div>`
      : "";
  const noInitial =
    scenario.depositAmount === 0 && scenario.prepayAmount === 0
      ? `<div class="cell-sub">초기비용 없음</div>`
      : "";
  const purchaseLine =
    scenario.purchaseSurcharge > 0
      ? `<div class="cell-sub red">인수형 +${fmt(scenario.purchaseSurcharge)}</div>`
      : "";

  return `
    <td class="${isHighlight ? "cell-highlight" : ""}">
      <div class="cell-monthly ${isHighlight ? "cell-monthly-highlight" : ""}">
        ${fmtMonthly(scenario.monthlyPayment)}
      </div>
      ${depositLine}${prepayLine}${noInitial}
      <div class="cell-finance">${scenario.bestFinanceCompany}</div>
      ${purchaseLine}
    </td>`;
}

export function generateQuotePDFHtml(data: PDFQuoteData): string {
  const quoteNumber = generateQuoteNumber();
  const today = formatDate();
  const expiry = formatExpiryDate();

  const optionsText =
    data.selectedOptions.length > 0
      ? data.selectedOptions
          .map((o) => `${o.name} <span style="color:#9BA4C0">(${fmt(o.price)})</span>`)
          .join(" &middot; ")
      : "<span style='color:#9BA4C0'>선택 옵션 없음</span>";

  const mileageLabel = `연 ${(data.annualMileage / 10000).toFixed(0)}만km`;
  const { conservative, standard, aggressive } = data.scenarios;

  const isProductRent = data.productType === "장기렌트";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>아임딜러 공식 견적서</title>
  <style>
    :root {
      --primary: #000666;
      --accent: #6066EE;
      --border: #e0e2ee;
      --bg: #f8f9fc;
      --text: #1a1a2e;
      --muted: #9BA4C0;
      --red: #d93025;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif;
      color: var(--text);
      background: #fff;
      line-height: 1.6;
      padding: 36px 42px;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .wrap { max-width: 740px; margin: 0 auto; }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2.5px solid var(--primary);
      padding-bottom: 16px;
      margin-bottom: 26px;
    }

    .brand { font-size: 24px; font-weight: 700; color: var(--primary); letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: var(--muted); margin-top: 3px; }

    .quote-meta { text-align: right; font-size: 12px; color: var(--muted); line-height: 1.9; }
    .quote-no { font-size: 13px; font-weight: 600; color: var(--primary); }

    /* Sections */
    .section { margin-bottom: 20px; }

    .sec-title {
      font-size: 12px; font-weight: 700; color: var(--primary);
      text-transform: uppercase; letter-spacing: 0.06em;
      padding-left: 10px; border-left: 3px solid var(--accent);
      margin-bottom: 9px;
    }

    /* Info Table */
    table { width: 100%; border-collapse: collapse; }

    th, td {
      padding: 8px 11px;
      border: 1px solid var(--border);
      font-size: 13px;
      vertical-align: middle;
    }

    th {
      background: var(--bg);
      font-weight: 500;
      color: #5a607a;
      white-space: nowrap;
      width: 22%;
    }

    td { color: var(--text); }

    .td-bold { font-weight: 700; color: var(--primary); }

    /* Scenario comparison */
    .scenario-tbl thead th {
      text-align: center;
      padding: 10px 8px;
      font-size: 13px;
    }

    .th-label { display: block; font-weight: 700; color: var(--text); }
    .th-desc { display: block; font-size: 11px; font-weight: 400; color: var(--muted); margin-top: 2px; }

    .th-highlight { background: var(--primary) !important; }
    .th-highlight .th-label { color: #fff; }
    .th-highlight .th-desc { color: rgba(255,255,255,0.65); }

    .scenario-tbl tbody td { text-align: center; padding: 10px 8px; }

    .cell-highlight { background: #eeeefa !important; }

    .cell-monthly { font-size: 15px; font-weight: 700; color: var(--text); }
    .cell-monthly-highlight { color: var(--primary); font-size: 17px; }

    .cell-sub { font-size: 11px; color: var(--muted); margin-top: 3px; }
    .cell-sub.red { color: var(--red); }
    .cell-finance { font-size: 11px; color: var(--accent); font-weight: 500; margin-top: 4px; }

    /* Result box */
    .result-box {
      background: #eeeefa;
      border: 1.5px solid var(--primary);
      border-radius: 8px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
    }

    .res-label { font-size: 14px; font-weight: 700; color: var(--primary); }
    .res-sub { font-size: 11px; color: var(--muted); margin-top: 3px; line-height: 1.7; }
    .res-value { font-size: 22px; font-weight: 700; color: var(--red); text-align: right; }
    .res-value-sub { font-size: 11px; color: var(--muted); text-align: right; margin-top: 3px; }

    /* Notice */
    .notice {
      background: #fff9f9;
      border: 1px solid #fde0e0;
      border-radius: 6px;
      padding: 13px 15px;
      margin-top: 18px;
    }

    .notice-title { font-size: 12px; font-weight: 700; color: var(--red); margin-bottom: 7px; }

    .notice ul { list-style: none; padding: 0; }
    .notice li {
      font-size: 11px;
      color: #666;
      padding-left: 12px;
      position: relative;
      margin-bottom: 4px;
      line-height: 1.6;
    }
    .notice li::before { content: "•"; color: var(--red); position: absolute; left: 0; }

    /* Footer */
    .footer {
      margin-top: 26px;
      border-top: 1px solid var(--border);
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .footer-l { font-size: 11px; color: var(--muted); line-height: 1.9; }
    .footer-r { text-align: right; font-size: 11px; color: var(--muted); }
    .footer-brand { font-size: 13px; font-weight: 700; color: var(--primary); }

    @media print {
      body { padding: 20px; }
    }
  </style>
</head>
<body>
<div class="wrap">

  <!-- 헤더 -->
  <div class="header">
    <div>
      <div class="brand">IM DEALER</div>
      <div class="brand-sub">아임딜러 장기렌트/리스 공식 견적서</div>
    </div>
    <div class="quote-meta">
      <div class="quote-no">견적번호: ${quoteNumber}</div>
      <div>산출일: ${today}</div>
      <div>유효기간: ${expiry} 까지</div>
    </div>
  </div>

  <!-- 1. 차량 기본 정보 -->
  <div class="section">
    <div class="sec-title">1. 차량 기본 정보</div>
    <table>
      <tr>
        <th>제조사 및 차종</th>
        <td>${data.vehicleBrand} ${data.vehicleName}</td>
        <th>상세 트림명</th>
        <td>${data.trimName}</td>
      </tr>
      <tr>
        <th>선택 옵션</th>
        <td colspan="3">${optionsText}</td>
      </tr>
      <tr>
        <th>트림 기본가</th>
        <td>${fmt(data.trimPrice)}</td>
        <th>총 차량 가격</th>
        <td class="td-bold">${fmt(data.totalVehiclePrice)}</td>
      </tr>
    </table>
  </div>

  <!-- 2. 계약 조건 -->
  <div class="section">
    <div class="sec-title">2. 계약 조건</div>
    <table>
      <tr>
        <th>상품 유형</th>
        <td>${data.productType}</td>
        <th>계약 종류</th>
        <td>${data.contractType}</td>
      </tr>
      <tr>
        <th>계약 기간</th>
        <td>${data.contractMonths}개월</td>
        <th>약정 주행거리</th>
        <td>${mileageLabel}</td>
      </tr>
    </table>
  </div>

  <!-- 3. 시나리오별 견적 비교 -->
  <div class="section">
    <div class="sec-title">3. 시나리오별 견적 비교</div>
    <table class="scenario-tbl">
      <thead>
        <tr>
          <th style="width:20%;background:var(--bg);"></th>
          <th>
            <span class="th-label">보수형</span>
            <span class="th-desc">보증금 20% · 월납입 절약</span>
          </th>
          <th class="th-highlight">
            <span class="th-label">표준형 ★</span>
            <span class="th-desc">균형 조건 · 기본 추천</span>
          </th>
          <th>
            <span class="th-label">공격형</span>
            <span class="th-desc">선납금 30% · 월납입 최소</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>월 납입금</th>
          ${scenarioCell(conservative, false)}
          ${scenarioCell(standard, true)}
          ${scenarioCell(aggressive, false)}
        </tr>
        <tr>
          <th>최우선 금융사</th>
          <td style="text-align:center;font-size:12px;">${conservative.bestFinanceCompany}</td>
          <td class="cell-highlight" style="text-align:center;font-size:12px;font-weight:600;color:var(--primary)">${standard.bestFinanceCompany}</td>
          <td style="text-align:center;font-size:12px;">${aggressive.bestFinanceCompany}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 4. 기본 추천 견적 (표준형) -->
  <div class="section">
    <div class="sec-title">4. 기본 추천 견적 (표준형)</div>
    <div class="result-box">
      <div>
        <div class="res-label">최종 월 납입금</div>
        <div class="res-sub">
          금융사: ${standard.bestFinanceCompany} · 아임딜러 최저가 매칭
          ${standard.purchaseSurcharge > 0 ? `<br/>인수형 가산: +${fmt(standard.purchaseSurcharge)} 포함` : ""}
        </div>
      </div>
      <div>
        <div class="res-value">${fmtMonthly(standard.monthlyPayment)}</div>
        ${isProductRent ? `<div class="res-value-sub">취등록세 · 자동차세 · 보험료 포함</div>` : ""}
      </div>
    </div>
  </div>

  <!-- 유의사항 -->
  <div class="notice">
    <div class="notice-title">⚠ 유의사항 고지</div>
    <ul>
      <li>본 견적은 산출일 기준이며, 금융사 금리 변동 및 제조사 차량 가격 인상 등에 따라 실제 계약 시 금액이 변동될 수 있습니다.</li>
      <li>차량 출고 시점에 따라 보조금 및 세제혜택이 변동될 수 있습니다.</li>
      <li>유효기간(${expiry}) 경과 후에는 새로운 견적 산출이 필요합니다.</li>
      ${isProductRent ? "<li>장기렌트의 경우 취득세, 자동차세, 의무보험료가 월 납입금에 포함되어 있습니다.</li>" : ""}
    </ul>
  </div>

  <!-- 푸터 -->
  <div class="footer">
    <div class="footer-l">
      <div>고객 이메일: ${data.userEmail}</div>
      <div>산출일: ${today} &nbsp;|&nbsp; 유효기간: ${expiry} 까지</div>
    </div>
    <div class="footer-r">
      <div class="footer-brand">IM DEALER</div>
      <div>본 견적서는 아임딜러 시스템에 의해 자동 생성되었습니다.</div>
    </div>
  </div>

</div>
</body>
</html>`;
}
