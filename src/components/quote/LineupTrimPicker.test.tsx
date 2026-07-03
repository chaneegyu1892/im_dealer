import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LineupTrimPicker } from "./LineupTrimPicker";

const LINEUPS = [
  { name: "2026년형 하이브리드", trimCount: 2 },
  { name: "2026년형 가솔린 2.5", trimCount: 1 },
] as const;

const TRIMS = [
  {
    id: "trim-prestige",
    name: "프레스티지",
    extra: null,
    price: 43_200_000,
    discountPrice: null,
  },
  {
    id: "trim-signature",
    name: "시그니처",
    extra: "AWD",
    price: 47_500_000,
    discountPrice: 46_800_000,
  },
] as const;

describe("LineupTrimPicker", () => {
  it("라인업과 트림을 드롭다운 단계로 보여준다", () => {
    const onLineupChange = vi.fn();
    const onTrimChange = vi.fn();

    render(
      <LineupTrimPicker
        hasCascade
        lineups={LINEUPS}
        selectedLineup={null}
        onLineupChange={onLineupChange}
        trims={[]}
        selectedTrimId={null}
        onTrimChange={onTrimChange}
      />
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("라인업")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("트림")).toBeInTheDocument();
    expect(screen.getByLabelText("라인업 선택")).toHaveDisplayValue("라인업을 선택하세요");
    expect(screen.getByRole("option", { name: "2026년형 하이브리드 · 2개 트림" })).toBeInTheDocument();
    expect(screen.getByLabelText("트림 선택")).toBeDisabled();
    expect(screen.getByLabelText("트림 선택")).toHaveDisplayValue("라인업을 먼저 선택하세요");
  });

  it("라인업 드롭다운을 바꾸면 트림 선택을 비운다", () => {
    const onLineupChange = vi.fn();
    const onTrimChange = vi.fn();

    render(
      <LineupTrimPicker
        hasCascade
        lineups={LINEUPS}
        selectedLineup="2026년형 가솔린 2.5"
        onLineupChange={onLineupChange}
        trims={[]}
        selectedTrimId="old-trim"
        onTrimChange={onTrimChange}
      />
    );

    fireEvent.change(screen.getByLabelText("라인업 선택"), {
      target: { value: "2026년형 하이브리드" },
    });

    expect(onLineupChange).toHaveBeenCalledWith("2026년형 하이브리드");
    expect(onTrimChange).toHaveBeenCalledWith(null);
  });

  it("선택된 라인업 안에서 가격이 보이는 트림 옵션을 선택한다", () => {
    const onLineupChange = vi.fn();
    const onTrimChange = vi.fn();

    render(
      <LineupTrimPicker
        hasCascade
        lineups={LINEUPS}
        selectedLineup="2026년형 하이브리드"
        onLineupChange={onLineupChange}
        trims={TRIMS}
        selectedTrimId={null}
        onTrimChange={onTrimChange}
      />
    );

    expect(screen.getByRole("option", { name: "시그니처 (AWD) · 4,680만원 (할인)" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("트림 선택"), {
      target: { value: "trim-signature" },
    });

    expect(onTrimChange).toHaveBeenCalledWith("trim-signature");
  });
});
