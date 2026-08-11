import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarsFilterPanel, VEHICLE_CATEGORIES } from "./CarsFilterPanel";

describe("CarsFilterPanel", () => {
  it("전기차 칩과 번개 아이콘을 표시하고 트럭 칩은 제외한다", () => {
    const { container } = render(
      <CarsFilterPanel
        brands={[]}
        categoryFilter="전체"
        brandFilter="전체"
        sortBy="popular"
        searchQuery=""
        sortOpen={false}
        activeFilterCount={0}
        currentSortLabel="인기순"
        totalCount={0}
        onCategoryChange={vi.fn()}
        onBrandChange={vi.fn()}
        onSortChange={vi.fn()}
        onSortToggle={vi.fn()}
        onSearchChange={vi.fn()}
        onResetFilters={vi.fn()}
      />,
    );

    expect(VEHICLE_CATEGORIES).toEqual(["전체", "세단", "SUV", "밴", "전기차"]);
    expect(screen.getByRole("button", { name: /전기차/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /트럭/ })).not.toBeInTheDocument();
    expect(container.querySelector("svg.lucide-zap")).toBeInTheDocument();
  });

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
