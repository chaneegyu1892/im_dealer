import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VehicleListItem } from "@/types/api";
import { CarsResultsSection } from "./CarsResultsSection";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    readonly href: string;
    readonly children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
    }: {
      readonly children?: React.ReactNode;
      readonly className?: string;
    }) => <div className={className}>{children}</div>,
  },
}));

vi.mock("@/components/cars/CarCard", () => ({
  CarCard: ({ vehicle }: { readonly vehicle: VehicleListItem }) => <p>{vehicle.name}</p>,
}));

function renderEmpty(overrides: Partial<Parameters<typeof CarsResultsSection>[0]> = {}) {
  return render(
    <CarsResultsSection
      isBrowsing
      vehicles={[]}
      suggestedVehicles={[]}
      searchQuery=""
      categoryFilter="화물"
      brandFilter="테슬라"
      sortBy="popular"
      hasActiveFilters
      quoteLoadFailed={false}
      onCategorySelect={vi.fn()}
      onBrandReset={vi.fn()}
      onCategoryReset={vi.fn()}
      onClearAll={vi.fn()}
      onScrollToFilters={vi.fn()}
      {...overrides}
    />,
  );
}

describe("CarsResultsSection 빈 결과", () => {
  it("결과 0건이면 조건 완화 제안과 원클릭 해제를 보여 준다", () => {
    const onBrandReset = vi.fn();
    const onCategoryReset = vi.fn();
    const onClearAll = vi.fn();

    renderEmpty({ onBrandReset, onCategoryReset, onClearAll });

    expect(screen.getByText("해당 조건의 차량이 없어요")).toBeInTheDocument();
    expect(screen.getByText("검색 결과")).toBeInTheDocument();
    expect(screen.queryByText("불러오는 중")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "브랜드 범위를 넓혀보세요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "차종 조건을 풀어보세요" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "브랜드 범위를 넓혀보세요" }));
    fireEvent.click(screen.getByRole("button", { name: "차종 조건을 풀어보세요" }));
    fireEvent.click(screen.getByRole("button", { name: "검색·필터 초기화" }));

    expect(onBrandReset).toHaveBeenCalledTimes(1);
    expect(onCategoryReset).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("적용된 필터 칩은 모바일에서도 숨기지 않아 바로 해제할 수 있다", () => {
    renderEmpty();

    expect(screen.getByRole("button", { name: "테슬라" })).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "화물" })).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "테슬라" }).parentElement).not.toHaveClass(
      "hidden",
      "sm:flex",
    );
  });
});
