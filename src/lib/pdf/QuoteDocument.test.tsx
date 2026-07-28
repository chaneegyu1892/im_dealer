import { isValidElement, type ReactNode } from "react";
import { Text } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import type { QuoteScenarioDetail } from "@/types/quote";
import { QuoteDocument } from "./QuoteDocument";

type ScenarioCellProps = {
  readonly sc?: QuoteScenarioDetail;
  readonly hi?: boolean;
  readonly children?: ReactNode;
};

type TextProps = {
  readonly children?: ReactNode;
};

function scenario(monthlyPayment: number, initial: "deposit" | "none" | "prepay"): QuoteScenarioDetail {
  return {
    monthlyPayment,
    depositAmount: initial === "deposit" ? 8_000_000 : 0,
    prepayAmount: initial === "prepay" ? 12_000_000 : 0,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
    bestFinanceCompany: `금융사-${monthlyPayment}`,
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
  };
}

const legacyData: PDFQuoteData = {
  vehicleName: "테스트 차량",
  vehicleBrand: "테스트",
  trimName: "테스트 트림",
  trimPrice: 40_000_000,
  selectedOptions: [],
  totalVehiclePrice: 40_000_000,
  productType: "장기렌트",
  contractMonths: 48,
  annualMileage: 20_000,
  contractType: "반납형",
  scenarios: {
    conservative: scenario(611_111, "deposit"),
    standard: scenario(722_222, "none"),
    aggressive: scenario(533_333, "prepay"),
  },
  userEmail: "customer@example.com",
};

function collectScenarioCells(node: ReactNode): ScenarioCellProps[] {
  if (Array.isArray(node)) return node.flatMap(collectScenarioCells);
  if (!isValidElement<ScenarioCellProps>(node)) return [];
  const current = node.props.sc ? [node.props] : [];
  return [...current, ...collectScenarioCells(node.props.children)];
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (!isValidElement<TextProps>(node)) return "";
  return textContent(node.props.children);
}

function collectTextElements(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(collectTextElements);
  if (!isValidElement<TextProps>(node)) return [];
  const current = node.type === Text ? [textContent(node)] : [];
  return [...current, ...collectTextElements(node.props.children)];
}

describe("QuoteDocument scenario presentation", () => {
  it("keeps the legacy conservative-left, standard-highlighted-center, aggressive-right layout when no selection exists", () => {
    // Given: legacy quote data without scenarioType
    const document = QuoteDocument({ data: legacyData });

    // When: the scenario comparison and main result are constructed
    const cells = collectScenarioCells(document);
    const textElements = collectTextElements(document);

    // Then: the exact established semantic ordering and standard main quote remain
    expect(cells.map(({ sc }) => sc?.monthlyPayment)).toEqual([611_111, 722_222, 533_333]);
    expect(cells.map(({ hi }) => hi)).toEqual([false, true, false]);
    expect(textElements).toContain("5. 기본 추천 견적 (무보증)");
    expect(textElements).toContain("월 722,222원");
  });

  it("centers and highlights the aggressive scenario when prepayment is selected", () => {
    // Given: the customer's final quote selection uses prepayment
    const selectedData = { ...legacyData, scenarioType: "aggressive" as const };

    // When: the scenario comparison and main result are constructed
    const document = QuoteDocument({ data: selectedData });
    const cells = collectScenarioCells(document);
    const textElements = collectTextElements(document);

    // Then: the prepayment quote is the highlighted center card and main result
    expect(cells.map(({ sc }) => sc?.monthlyPayment)).toEqual([611_111, 533_333, 722_222]);
    expect(cells.map(({ hi }) => hi)).toEqual([false, true, false]);
    expect(textElements).toContain("5. 선택 견적 (선납금)");
    expect(textElements).toContain("월 533,333원");
  });

  it("omits the customer email from a public Kakao delivery image", () => {
    const publicDeliveryData: PDFQuoteData = {
      ...legacyData,
      userEmail: null,
    };

    const document = QuoteDocument({ data: publicDeliveryData });
    const textElements = collectTextElements(document);

    expect(textElements.some((text) => text.startsWith("고객 이메일:"))).toBe(false);
    expect(textElements).toContain(
      "본 견적서는 아임딜러 시스템에 의해 자동 생성되었습니다."
    );
  });
});
