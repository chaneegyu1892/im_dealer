import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarsStickyFilterBar } from "./CarsStickyFilterBar";

describe("CarsStickyFilterBar 모바일 너비", () => {
  it("430px 이하에서도 적용된 필터 칩을 눌러 바로 해제할 수 있다", () => {
    render(
      <CarsStickyFilterBar
        brandFilter="현대"
        categoryFilter="RV"
        activeFilterCount={2}
        currentSortLabel="가격 높은순"
        searchQuery="투싼"
        sortBy="price-desc"
        sortOpen={false}
        onBrandChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onSearchChange={vi.fn()}
        onSortChange={vi.fn()}
        onSortToggle={vi.fn()}
        onScrollToFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /필터/ })).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "현대" })).not.toHaveClass("max-[430px]:hidden");
    expect(screen.getByRole("button", { name: "RV" })).not.toHaveClass("max-[430px]:hidden");
    expect(screen.getByPlaceholderText("검색").parentElement).toHaveClass(
      "max-[430px]:min-w-0",
    );
    expect(screen.getByRole("button", { name: "가격 높은순" })).toHaveClass(
      "max-[430px]:w-[88px]",
      "max-[430px]:min-w-[88px]",
    );
  });
});
