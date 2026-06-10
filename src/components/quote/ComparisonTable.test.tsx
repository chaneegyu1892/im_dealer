// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonTable, type ComparisonColumnConfig } from "./ComparisonTable";
import type { QuoteResponse } from "@/types/api";

function makeResult(overrides: Partial<QuoteResponse> = {}): QuoteResponse {
  return {
    vehicleSlug: "test",
    trimId: "t1",
    trimName: "프리미엄",
    trimPrice: 42_500_000,
    optionsTotalPrice: 1_440_000,
    colorDelta: 100_000,
    contractMonths: 48,
    annualMileage: 20000,
    contractType: "반납형",
    scenarios: {
      standard: {
        monthlyPayment: 608_954,
        contractMonths: 48,
        depositAmount: 0,
        prepayAmount: 0,
        bestFinanceCompany: "오릭스",
      },
    } as unknown as QuoteResponse["scenarios"],
    ...overrides,
  };
}

const CONFIG: ComparisonColumnConfig = {
  lineupName: "2027년형 가솔린 2.5 2WD (개소세 5% 기준)",
  optionNames: ["컨비니언스", "현대 스마트센스Ⅰ"],
  exteriorColor: { name: "트랜스미션 블루 펄", priceDelta: 0 },
  interiorColor: { name: "블랙 모노톤", priceDelta: 100_000 },
};

describe("ComparisonTable 구성 정보", () => {
  it("라인업/기본 차량가/선택 옵션/색상 행이 표시된다", () => {
    render(
      <ComparisonTable
        primary={{ brand: "현대", name: "더 뉴 그랜저", result: makeResult(), config: CONFIG }}
        comparison={{
          brand: "기아",
          name: "K8",
          result: makeResult({ trimName: "노블레스", trimPrice: 39_000_000 }),
          config: { ...CONFIG, lineupName: "2026년형 가솔린 2.5", optionNames: [] },
        }}
      />
    );

    expect(screen.getAllByText("라인업 (연식/엔진)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2027년형 가솔린 2.5 2WD (개소세 5% 기준)").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2개 · 컨비니언스, 현대 스마트센스Ⅰ/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("없음").length).toBeGreaterThan(0); // 비교 차량 옵션 없음
    expect(screen.getAllByText(/외장 트랜스미션 블루 펄/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/내장 블랙 모노톤 \(\+10만원\)/).length).toBeGreaterThan(0);
  });

  it("총 차량가는 할인가·색상 추가금을 포함해 계산한다", () => {
    const result = makeResult({ discountPrice: 41_000_000 });
    render(
      <ComparisonTable
        primary={{ brand: "현대", name: "더 뉴 그랜저", result, config: CONFIG }}
        comparison={{ brand: "기아", name: "K8", result: makeResult(), config: CONFIG }}
      />
    );
    // 41,000,000(할인) + 1,440,000(옵션) + 100,000(색상) = 42,540,000 → 4,254만원
    expect(screen.getAllByText("4,254만원").length).toBeGreaterThan(0);
    // 기본 차량가 행: 할인가 + 정가 취소선
    expect(screen.getAllByText("41,000,000원").length).toBeGreaterThan(0);
    expect(screen.getAllByText("42,500,000원").length).toBeGreaterThan(0);
  });

  it("config 없이도 기존처럼 렌더된다 (구성 행 생략)", () => {
    render(
      <ComparisonTable
        primary={{ brand: "현대", name: "더 뉴 그랜저", result: makeResult() }}
        comparison={{ brand: "기아", name: "K8", result: makeResult() }}
      />
    );
    expect(screen.queryByText("라인업 (연식/엔진)")).toBeNull();
    expect(screen.getAllByText(/총 차량가/).length).toBeGreaterThan(0);
  });
});
