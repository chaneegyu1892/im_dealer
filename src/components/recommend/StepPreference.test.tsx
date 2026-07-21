import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  NO_SITUATION_PREFERENCE_VALUE,
} from "@/constants/recommend-options";
import { StepPreference } from "./StepPreference";

function renderStepPreference(overrides?: {
  readonly simpleValue?: string;
  readonly situationValue?: string;
  readonly childDetail?: string;
  readonly cargoDetail?: string;
}) {
  const onSimpleChange = vi.fn();
  const onSituationChange = vi.fn();
  const onChildDetailChange = vi.fn();
  const onCargoDetailChange = vi.fn();
  const onComplete = vi.fn();

  render(
    <StepPreference
      simpleValue={overrides?.simpleValue ?? ""}
      onSimpleChange={onSimpleChange}
      situationValue={overrides?.situationValue ?? ""}
      onSituationChange={onSituationChange}
      childDetail={overrides?.childDetail ?? ""}
      onChildDetailChange={onChildDetailChange}
      cargoDetail={overrides?.cargoDetail ?? ""}
      onCargoDetailChange={onCargoDetailChange}
      onComplete={onComplete}
    />
  );

  return {
    onSimpleChange,
    onSituationChange,
    onChildDetailChange,
    onCargoDetailChange,
    onComplete,
  };
}

function sectionForHeading(name: string): HTMLElement {
  const section = screen.getByRole("heading", { name }).closest("section");
  if (!(section instanceof HTMLElement)) {
    throw new Error(`Section not found for ${name}`);
  }
  return section;
}

describe("StepPreference", () => {
  it("AI 자동 추천과 추가 조건 해당 없음을 각각 받는다", () => {
    const { onSimpleChange, onSituationChange, onComplete } = renderStepPreference();

    const simpleSection = sectionForHeading("가장 가까운 스타일을 하나 골라주세요");
    const situationSection = sectionForHeading("아이나 짐 관련 조건이 있나요?");

    fireEvent.click(within(simpleSection).getByRole("button", { name: /AI에게 맡길게요/ }));
    fireEvent.click(within(situationSection).getByRole("button", { name: /해당 없음/ }));

    expect(onSimpleChange).toHaveBeenCalledWith("auto");
    expect(onSituationChange).toHaveBeenCalledWith(NO_SITUATION_PREFERENCE_VALUE);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("AI 자동 추천과 추가 조건 해당 없음에 아이콘을 표시한다", () => {
    renderStepPreference();

    const simpleSection = sectionForHeading("가장 가까운 스타일을 하나 골라주세요");
    const situationSection = sectionForHeading("아이나 짐 관련 조건이 있나요?");

    expect(within(simpleSection).getByRole("button", { name: /AI에게 맡길게요/ })).toHaveTextContent("🤖");
    expect(within(situationSection).getByRole("button", { name: /해당 없음/ }).querySelector("svg")).not.toBeNull();
  });

  it("심화 질문에서 해당 없음을 고르면 추가 질문을 보여주지 않는다", () => {
    renderStepPreference({
      simpleValue: "low-running-cost",
      situationValue: NO_SITUATION_PREFERENCE_VALUE,
    });

    expect(screen.queryByText("추가 질문")).not.toBeInTheDocument();
  });

  it("가족을 고르면 가족 상세 질문을 보여준다", () => {
    const { onChildDetailChange, onComplete } = renderStepPreference({
      simpleValue: "family-leisure",
      situationValue: "가족",
    });

    fireEvent.click(screen.getByRole("button", { name: /영유아/ }));

    expect(screen.getByText("자녀 연령대는 어떻게 되나요?")).toBeInTheDocument();
    expect(onChildDetailChange).toHaveBeenCalledWith("영유아");
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
