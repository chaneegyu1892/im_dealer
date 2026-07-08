import { createElement } from "react";
import type { QuoteDocumentData } from "@/lib/quote-document-template";
import { Cell, ColorLine, FinanceName, ScenarioCard, SectionTitle } from "./QuoteImageParts";
import {
  C,
  INSURANCE_TERMS,
  fmt,
  fmtMonthly,
  formatDate,
  formatExpiryDate,
  generateQuoteNumber,
  st,
} from "./quote-image-style";

export const QUOTE_IMAGE_WIDTH = 1240;
export const QUOTE_IMAGE_HEIGHT = 1754;

export function QuoteImage({
  data,
  financeLogos,
  brandLogo,
}: {
  readonly data: QuoteDocumentData;
  readonly financeLogos: Record<string, string>;
  readonly brandLogo: string | null;
}) {
  const quoteNumber = generateQuoteNumber();
  const today = formatDate();
  const expiry = formatExpiryDate();
  const mileageLabel = `연 ${(data.annualMileage / 10000).toFixed(0)}만km`;
  const { conservative, standard, aggressive } = data.scenarios;
  const hasOptions = data.selectedOptions.length > 0;
  const optionSubtotal = data.selectedOptions.reduce((sum, o) => sum + o.price, 0);
  const isProductRent = data.productType === "장기렌트";
  const showInsurance = isProductRent;
  const nInsurance = 3;
  const nScenario = showInsurance ? 4 : 3;
  const nResult = showInsurance ? 5 : 4;
  const optionsText = hasOptions
    ? data.selectedOptions.map((o) => `${o.name} (${fmt(o.price)})`).join("  ·  ")
    : "선택 옵션 없음";

  return (
    <div style={st.page}>
      <div style={st.header}>
        <div style={st.brandBlock}>
          {brandLogo ? createElement("img", { src: brandLogo, alt: "아임딜러", style: st.brandLogo }) : <div style={st.brandText}>IM DEALER</div>}
          <div style={st.brandSub}>아임딜러 장기렌트/리스 공식 견적서 이미지</div>
        </div>
        <div style={st.meta}>
          <div style={st.quoteNo}>{`견적번호: ${quoteNumber}`}</div>
          <div style={st.metaLine}>{`산출일: ${today}`}</div>
          <div style={st.metaLine}>{`유효기간: ${expiry} 까지`}</div>
        </div>
      </div>

      <div style={st.section}>
        <SectionTitle>1. 차량 기본 정보</SectionTitle>
        <div style={st.table}>
          <div style={st.row}>
            <Cell label="제조사 및 차종" value={`${data.vehicleBrand} ${data.vehicleName}`} labelWidth="22%" valueWidth="28%" />
            <Cell label="상세 트림명" value={data.trimName} labelWidth="22%" valueWidth="28%" />
          </div>
          <div style={st.row}>
            <div style={{ ...st.th, width: "22%" }}>선택 옵션</div>
            <div style={{ ...st.td, width: "78%", color: hasOptions ? C.text : C.muted }}>{optionsText}</div>
          </div>
          {hasOptions ? (
            <div style={st.row}>
              <Cell label="옵션 소계" value={fmt(optionSubtotal)} labelWidth="22%" valueWidth="78%" bold />
            </div>
          ) : null}
          {data.exteriorColor || data.interiorColor ? (
            <div style={st.row}>
              <div style={{ ...st.th, width: "22%" }}>색상 선택</div>
              <div style={{ ...st.td, width: "78%" }}>
                <ColorLine label="외장:" c={data.exteriorColor} />
                <ColorLine label="내장:" c={data.interiorColor} />
              </div>
            </div>
          ) : null}
          <div style={st.row}>
            <Cell label="트림 기본가" value={fmt(data.trimPrice)} labelWidth="22%" valueWidth="28%" />
            <Cell label="총 차량 가격" value={fmt(data.totalVehiclePrice)} labelWidth="22%" valueWidth="28%" bold />
          </div>
        </div>
      </div>

      <div style={st.section}>
        <SectionTitle>2. 계약 조건</SectionTitle>
        <div style={st.table}>
          <div style={st.row}>
            <Cell label="상품 유형" value={data.productType} labelWidth="22%" valueWidth="28%" />
            <Cell label="계약 종류" value={data.contractType} labelWidth="22%" valueWidth="28%" />
          </div>
          <div style={st.row}>
            <Cell label="계약 기간" value={`${data.contractMonths}개월`} labelWidth="22%" valueWidth="28%" />
            <Cell label="약정 주행거리" value={mileageLabel} labelWidth="22%" valueWidth="28%" />
          </div>
        </div>
      </div>

      {showInsurance ? (
        <div style={st.section}>
          <SectionTitle>{`${nInsurance}. 보험 조건`}</SectionTitle>
          <div style={st.table}>
            {[0, 2, 4].map((start) => (
              <div style={st.row} key={start}>
                <Cell label={INSURANCE_TERMS[start].label} value={INSURANCE_TERMS[start].value} labelWidth="22%" valueWidth="28%" />
                <Cell label={INSURANCE_TERMS[start + 1].label} value={INSURANCE_TERMS[start + 1].value} labelWidth="22%" valueWidth="28%" />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={st.section}>
        <SectionTitle>{`${nScenario}. 시나리오별 견적 비교`}</SectionTitle>
        <div style={st.table}>
          <div style={st.row}>
            <div style={{ ...st.scenarioHead, width: "20%" }} />
            <div style={{ ...st.scenarioHead, width: "26.66%" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>보증금</div>
              <div style={st.small}>보증금 20% · 월납입 절약</div>
            </div>
            <div style={{ ...st.scenarioHead, ...st.scenarioHeadHi, width: "26.66%" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>무보증 추천</div>
              <div style={{ ...st.small, color: "rgba(255,255,255,0.78)" }}>초기비용 없음 · 기본 추천</div>
            </div>
            <div style={{ ...st.scenarioHead, width: "26.68%" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>선납금</div>
              <div style={st.small}>선납금 30% · 월납입 최소</div>
            </div>
          </div>
          <div style={st.row}>
            <div style={{ ...st.th, width: "20%" }}>월 납입금</div>
            <div style={{ display: "flex", width: "26.66%" }}><ScenarioCard sc={conservative} hi={false} /></div>
            <div style={{ display: "flex", width: "26.66%" }}><ScenarioCard sc={standard} hi /></div>
            <div style={{ display: "flex", width: "26.68%" }}><ScenarioCard sc={aggressive} hi={false} /></div>
          </div>
          <div style={st.row}>
            <div style={{ ...st.th, width: "20%" }}>최우선 금융사</div>
            <div style={{ ...st.td, justifyContent: "center", width: "26.66%" }}><FinanceName name={conservative.bestFinanceCompany} logos={financeLogos} /></div>
            <div style={{ ...st.td, ...st.scenarioCellHi, justifyContent: "center", width: "26.66%" }}><FinanceName name={standard.bestFinanceCompany} logos={financeLogos} hi /></div>
            <div style={{ ...st.td, justifyContent: "center", width: "26.68%" }}><FinanceName name={aggressive.bestFinanceCompany} logos={financeLogos} /></div>
          </div>
        </div>
      </div>

      <div style={st.section}>
        <SectionTitle>{`${nResult}. 기본 추천 견적 (무보증)`}</SectionTitle>
        <div style={st.resultBox}>
          <div style={st.resultLeft}>
            <div style={st.resultLabel}>최종 월 납입금</div>
            <div style={st.resultSub}>{`금융사: ${standard.bestFinanceCompany} · 아임딜러 최저가 매칭`}</div>
            {standard.purchaseSurcharge > 0 ? <div style={st.resultSub}>{`인수형 가산: +${fmt(standard.purchaseSurcharge)} 포함`}</div> : null}
          </div>
          <div style={st.resultRight}>
            <div style={st.resultValue}>{fmtMonthly(standard.monthlyPayment)}</div>
            {isProductRent ? <div style={st.resultSub}>취등록세 · 자동차세 · 보험료 포함</div> : null}
          </div>
        </div>
      </div>

      <div style={st.notice}>
        <div style={st.noticeTitle}>유의사항 고지</div>
        {[
          "본 견적은 산출일 기준이며, 금융사 금리 변동 및 제조사 차량 가격 인상 등에 따라 실제 계약 시 금액이 변동될 수 있습니다.",
          "차량 출고 시점에 따라 보조금 및 세제혜택이 변동될 수 있습니다.",
          `유효기간(${expiry}) 경과 후에는 새로운 견적 산출이 필요합니다.`,
          isProductRent
            ? "장기렌트의 경우 취득세, 자동차세, 의무보험료가 월 납입금에 포함되어 있습니다."
            : "자동차리스의 경우 금융사 및 상품 종류에 따라 자동차세 및 보험료가 월 납입금 외에 별도 청구될 수 있습니다.",
          "중도 해지 시 금융사별 규정에 따른 중도해지위약금이 발생합니다.",
        ].map((t) => (
          <div style={st.noticeItem} key={t}>
            <div style={st.bullet}>·</div>
            <div style={st.noticeText}>{t}</div>
          </div>
        ))}
      </div>

      <div style={st.footer}>
        <div style={st.footerLeft}>
          <div>{`고객 이메일: ${data.userEmail}`}</div>
          <div style={{ marginTop: 5 }}>{`산출일: ${today}  |  유효기간: ${expiry} 까지`}</div>
        </div>
        <div style={st.footerRight}>
          {brandLogo ? createElement("img", { src: brandLogo, alt: "아임딜러", style: st.footerLogo }) : <div style={st.footerBrand}>IM DEALER</div>}
          <div style={st.footerNote}>본 견적서는 아임딜러 시스템에 의해 자동 생성되었습니다.</div>
        </div>
      </div>
    </div>
  );
}
