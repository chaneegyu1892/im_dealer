// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuoteResponse } from "@/types/api";
import {
  ComparisonSection,
  type ContractConditions,
  type PrimaryVehicleInfo,
} from "./ComparisonSection";

vi.mock("@/hooks/useAuthUser", () => ({
  useAuthUser: () => ({ user: { id: "member-1" }, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? ""} />,
}));

function makeResult(): QuoteResponse {
  const scenario = {
    monthlyPayment: 600_000,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
    bestFinanceCompany: "테스트캐피탈",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
  };
  return {
    vehicleSlug: "grandeur",
    trimId: "trim-1",
    trimName: "프리미엄",
    trimPrice: 40_000_000,
    contractMonths: 48,
    annualMileage: 20_000,
    contractType: "반납형",
    scenarios: {
      conservative: scenario,
      standard: scenario,
      aggressive: scenario,
    },
  };
}

const primary: PrimaryVehicleInfo = {
  slug: "grandeur",
  brand: "현대",
  name: "그랜저",
  result: makeResult(),
  trims: [
    {
      id: "trim-1",
      name: "프리미엄",
      price: 40_000_000,
      engineType: "가솔린",
      isDefault: true,
      options: [],
    },
  ],
  currentTrimId: "trim-1",
  currentOptionIds: new Set(),
};

const conditions: ContractConditions = {
  contractMonths: 48,
  annualMileage: 20_000,
  contractType: "반납형",
  productType: "장기렌트",
};

describe("ComparisonSection 금액 기준 표기", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function settle() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("비교표 금액이 어떤 조건 기준인지 문구를 렌더한다", async () => {
    render(
      <ComparisonSection
        primary={primary}
        conditions={conditions}
        allVehicles={[]}
        primaryRates={{ depositRate: 0, prepayRate: 30 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /다른 차량과 비교하기/ }));
    await settle();

    expect(
      screen.getByText("비교 월납입금은 선납금 30% 기준입니다"),
    ).toBeInTheDocument();
  });

  it("메인 견적 조건이 바뀌면 기준 표기도 따라간다", async () => {
    const { rerender } = render(
      <ComparisonSection
        primary={primary}
        conditions={conditions}
        allVehicles={[]}
        primaryRates={{ depositRate: 0, prepayRate: 30 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /다른 차량과 비교하기/ }));
    await settle();
    expect(
      screen.getByText("비교 월납입금은 선납금 30% 기준입니다"),
    ).toBeInTheDocument();

    rerender(
      <ComparisonSection
        primary={primary}
        conditions={conditions}
        allVehicles={[]}
        primaryRates={{ depositRate: 20, prepayRate: 0 }}
      />,
    );
    await settle();

    expect(
      screen.getByText("비교 월납입금은 보증금 20% 기준입니다"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("비교 월납입금은 선납금 30% 기준입니다"),
    ).not.toBeInTheDocument();
  });
});
