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
});
