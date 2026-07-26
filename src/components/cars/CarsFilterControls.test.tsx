import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarsSearchControl, SortMenu } from "./CarsFilterControls";

describe("CarsFilterControls 좁은 모바일", () => {
  it("고정 필터 바에서는 검색과 정렬이 280px 안에서 줄어들 수 있다", () => {
    render(
      <div>
        <CarsSearchControl compact searchQuery="" onSearchChange={vi.fn()} />
        <SortMenu
          compact
          currentSortLabel="인기순"
          sortBy="popular"
          sortOpen={false}
          onToggle={vi.fn()}
          onChange={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByPlaceholderText("검색").parentElement).toHaveClass(
      "max-[430px]:h-11",
      "max-[430px]:min-w-0",
    );
    expect(screen.getByRole("button", { name: /인기순/ })).toHaveClass(
      "max-[430px]:h-11",
      "max-[430px]:w-[88px]",
      "max-[430px]:min-w-[88px]",
    );
  });

  it("상단 검색창은 341~430px에서 줄어들고 340px 이하에서는 높이를 유지한다", () => {
    render(<CarsSearchControl searchQuery="" onSearchChange={vi.fn()} />);

    expect(screen.getByPlaceholderText("차량·브랜드·용도").parentElement).toHaveClass(
      "h-12",
      "max-[430px]:min-w-0",
      "max-[340px]:w-full",
      "max-[340px]:flex-none",
    );
  });

  it("상단 필터 패널의 정렬 버튼은 좁은 화면에서 한 줄 전체 폭을 쓴다", () => {
    render(
      <SortMenu
        fullWidthOnNarrow
        currentSortLabel="가격 낮은순"
        sortBy="price-asc"
        sortOpen
        onToggle={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    const button = screen.getAllByRole("button", { name: "가격 낮은순" })[0];
    expect(button.parentElement).toHaveClass("max-[340px]:w-full");
    expect(button).toHaveClass(
      "max-[430px]:w-[96px]",
      "max-[340px]:w-full",
      "max-[340px]:min-w-0",
    );
    expect(button).toHaveTextContent("낮은가격");
    expect(screen.getByRole("button", { name: "가격 높은순" }).parentElement).toHaveClass(
      "max-[430px]:bottom-full",
      "max-[430px]:top-auto",
      "max-[340px]:w-full",
    );
  });
});
