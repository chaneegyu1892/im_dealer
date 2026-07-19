import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  NO_SIMPLE_PREFERENCE_VALUE,
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
  it("단순 질문과 심화 질문의 해당 없음 선택을 각각 받는다", () => {
    const { onSimpleChange, onSituationChange, onComplete } = renderStepPreference();

    const simpleSection = sectionForHeading("먼저 가장 중요한 방향을 골라주세요");
    const situationSection = sectionForHeading("아이나 짐 관련 조건이 있나요?");

    fireEvent.click(within(simpleSection).getByRole("button", { name: /해당 없음/ }));
    fireEvent.click(within(situationSection).getByRole("button", { name: /해당 없음/ }));

    expect(onSimpleChange).toHaveBeenCalledWith(NO_SIMPLE_PREFERENCE_VALUE);
    expect(onSituationChange).toHaveBeenCalledWith(NO_SITUATION_PREFERENCE_VALUE);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("각 해당 없음 선택지 왼쪽에도 아이콘을 표시한다", () => {
    renderStepPreference();

    const simpleSection = sectionForHeading("먼저 가장 중요한 방향을 골라주세요");
    const situationSection = sectionForHeading("아이나 짐 관련 조건이 있나요?");

    expect(within(simpleSection).getByRole("button", { name: /해당 없음/ }).querySelector("svg")).not.toBeNull();
    expect(within(situationSection).getByRole("button", { name: /해당 없음/ }).querySelector("svg")).not.toBeNull();
  });

  it("심화 질문에서 해당 없음을 고르면 추가 질문을 보여주지 않는다", () => {
    renderStepPreference({
      simpleValue: "경제성",
      situationValue: NO_SITUATION_PREFERENCE_VALUE,
    });

    expect(screen.queryByText("추가 질문")).not.toBeInTheDocument();
  });

  it("가족을 고르면 가족 상세 질문을 보여준다", () => {
    const { onChildDetailChange, onComplete } = renderStepPreference({
      simpleValue: "안정감",
      situationValue: "가족",
    });

    fireEvent.click(screen.getByRole("button", { name: /영유아/ }));

    expect(screen.getByText("자녀 연령대는 어떻게 되나요?")).toBeInTheDocument();
    expect(onChildDetailChange).toHaveBeenCalledWith("영유아");
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
