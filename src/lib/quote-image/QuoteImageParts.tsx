import { createElement } from "react";
import type { QuoteScenarioDetail } from "@/types/quote";
import type { QuoteDocumentColor } from "@/lib/quote-document-template";
import { C, fmt, fmtMonthly, formatColor, st } from "./quote-image-style";

export function Cell({ label, value, labelWidth, valueWidth, bold = false }: {
  readonly label: string;
  readonly value: string;
  readonly labelWidth: string;
  readonly valueWidth: string;
  readonly bold?: boolean;
}) {
  return (
    <>
      <div style={{ ...st.th, width: labelWidth }}>{label}</div>
      <div style={{ ...st.td, ...(bold ? st.tdBold : {}), width: valueWidth }}>{value}</div>
    </>
  );
}

export function ScenarioCard({ sc, hi }: { readonly sc: QuoteScenarioDetail; readonly hi: boolean }) {
  const noInitial = sc.depositAmount === 0 && sc.prepayAmount === 0;
  return (
    <div style={{ ...st.scenarioCell, ...(hi ? st.scenarioCellHi : {}) }}>
      <div style={{ ...st.monthly, ...(hi ? st.monthlyHi : {}) }}>{fmtMonthly(sc.monthlyPayment)}</div>
      {sc.depositAmount > 0 ? <div style={st.small}>{`보증금 ${fmt(sc.depositAmount)}`}</div> : null}
      {sc.prepayAmount > 0 ? <div style={st.small}>{`선납금 ${fmt(sc.prepayAmount)}`}</div> : null}
      {noInitial ? <div style={st.small}>초기비용 없음</div> : null}
      <div style={st.financeName}>{sc.bestFinanceCompany}</div>
      {sc.purchaseSurcharge > 0 ? (
        <div style={{ ...st.small, ...st.smallRed }}>{`인수형 +${fmt(sc.purchaseSurcharge)}`}</div>
      ) : null}
    </div>
  );
}

export function FinanceName({ name, logos, hi = false }: {
  readonly name: string;
  readonly logos: Record<string, string>;
  readonly hi?: boolean;
}) {
  const logo = logos[name];
  return (
    <div style={st.financeRow}>
      {logo ? createElement("img", { src: logo, alt: "", style: st.financeLogo }) : null}
      <div style={{ fontSize: 17, fontWeight: hi ? 800 : 600, color: hi ? C.primary : C.text }}>{name}</div>
    </div>
  );
}

export function ColorLine({ label, c }: { readonly label: string; readonly c: QuoteDocumentColor | null | undefined }) {
  if (!c) return null;
  return (
    <div style={st.colorRow}>
      <div style={{ fontSize: 16, color: C.muted, marginRight: 8 }}>{label}</div>
      <div style={{ ...st.chip, backgroundColor: c.hexCode }} />
      <div style={{ fontSize: 16 }}>{formatColor(c)}</div>
    </div>
  );
}

export function SectionTitle({ children }: { readonly children: string }) {
  return <div style={st.sectionTitle}>{children}</div>;
}
