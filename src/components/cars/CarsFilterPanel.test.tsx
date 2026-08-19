import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarsFilterPanel } from "./CarsFilterPanel";

describe("CarsFilterPanel 좁은 모바일", () => {
  it("브랜드 목록을 하단 메뉴에 가리지 않도록 위로 연다", () => {
    render(
      <CarsFilterPanel
        brands={["현대", "기아"]}
        categoryFilter="전체"
        brandFilter="전체"
        sortBy="popular"
        searchQuery=""
        sortOpen={false}
        activeFilterCount={0}
        currentSortLabel="인기순"
        totalCount={86}
        onCategoryChange={vi.fn()}
        onBrandChange={vi.fn()}
        onSortChange={vi.fn()}
        onSortToggle={vi.fn()}
        onSearchChange={vi.fn()}
        onResetFilters={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /브랜드 전체 브랜드/ }));

    expect(screen.getByRole("listbox")).toHaveClass(
      "max-[430px]:bottom-[calc(100%+8px)]",
      "max-[430px]:top-auto",
    );
  });

  it("430px 폭에서도 적용된 필터를 초기화할 수 있다", () => {
    const onResetFilters = vi.fn();

    render(
      <CarsFilterPanel
        brands={["현대", "기아"]}
        categoryFilter="RV"
        brandFilter="현대"
        sortBy="popular"
        searchQuery=""
        sortOpen={false}
        activeFilterCount={2}
        currentSortLabel="인기순"
        totalCount={86}
        onCategoryChange={vi.fn()}
        onBrandChange={vi.fn()}
        onSortChange={vi.fn()}
        onSortToggle={vi.fn()}
        onSearchChange={vi.fn()}
        onResetFilters={onResetFilters}
      />,
    );

    const reset = screen.getByRole("button", { name: "초기화" });
    const brandChip = screen.getByRole("button", { name: "현대" });
    const categoryChips = screen.getAllByRole("button", { name: "RV" });
    expect(reset).not.toHaveClass("max-[430px]:hidden");
    expect(brandChip).not.toHaveClass("max-[430px]:hidden");
    expect(categoryChips.every((chip) => !chip.className.includes("max-[430px]:hidden"))).toBe(true);
    fireEvent.click(reset);
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });
});
