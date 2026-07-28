import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarsSearchControl } from "./CarsFilterControls";

describe("CarsSearchControl 모바일 자동 확대 방지", () => {
  it.each([
    { compact: false, placeholder: "차량·브랜드·용도" },
    { compact: true, placeholder: "검색" },
  ])("$placeholder 입력 글자 크기를 16px로 유지한다", ({ compact, placeholder }) => {
    render(
      <CarsSearchControl
        compact={compact}
        searchQuery=""
        onSearchChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(placeholder)).toHaveClass("text-[16px]");
  });
});
