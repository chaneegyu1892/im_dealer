import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepIndustry } from "./StepIndustry";

describe("StepIndustry", () => {
  it("고객 유형을 고른 뒤 모든 유형에 같은 무보증 월예산 질문을 보여준다", () => {
    const onChange = vi.fn();
    const onBudgetChange = vi.fn();
    const onComplete = vi.fn();

    const { rerender } = render(
      <StepIndustry
        value=""
        onChange={onChange}
        budgetRange={null}
        onBudgetChange={onBudgetChange}
        onComplete={onComplete}
      />
    );

    expect(screen.queryByRole("heading", { name: "월 납입금 예산은 어느 정도인가요?" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /개인 직장인/ }));
    expect(onChange).toHaveBeenCalledWith("개인");

    rerender(
      <StepIndustry
        value="개인"
        onChange={onChange}
        budgetRange={null}
        onBudgetChange={onBudgetChange}
        onComplete={onComplete}
      />
    );

    expect(screen.getByRole("heading", { name: "월 납입금 예산은 어느 정도인가요?" })).toBeInTheDocument();
    expect(screen.getByText(/60개월 · 연 2만km · 무보증/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /100만원 이하/ }));
    expect(onBudgetChange).toHaveBeenCalledWith("lte-1000k");
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("승인된 다섯 예산 선택지만 제공한다", () => {
    render(
      <StepIndustry
        value="법인"
        onChange={vi.fn()}
        budgetRange={null}
        onBudgetChange={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /50만원 이하/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /80만원 이하/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /100만원 이하/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /100만원 이상/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI에게 맡길게요/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /150만원/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /예산 아직 미정/ })).not.toBeInTheDocument();
  });
});
