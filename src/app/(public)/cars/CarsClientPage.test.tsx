import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleListItem } from "@/types/api";
import { CarsClientPage } from "./CarsClientPage";

type FilterPanelMockProps = {
  readonly searchQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly onCategoryChange: (category: "RV") => void;
};

type ResultsSectionMockProps = {
  readonly isBrowsing: boolean;
  readonly vehicles: VehicleListItem[];
};

type MotionDivMockProps = ComponentProps<"div"> & {
  readonly initial?: unknown;
  readonly animate?: unknown;
  readonly exit?: unknown;
  readonly transition?: unknown;
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, className }: MotionDivMockProps) => (
      <div className={className}>{children}</div>
    ),
  },
}));

vi.mock("@/components/cars/CarsFilterPanel", () => ({
  CarsFilterPanel: ({
    searchQuery,
    onSearchChange,
    onCategoryChange,
  }: FilterPanelMockProps) => (
    <>
      <input
        aria-label="차량 검색"
        value={searchQuery}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value)}
      />
      <button type="button" onClick={() => onCategoryChange("RV")}>
        RV 필터
      </button>
    </>
  ),
}));

vi.mock("@/components/cars/CarsFilterControls", () => ({
  SORT_OPTIONS: [{ value: "popular", label: "인기순" }],
}));

vi.mock("@/components/cars/CarsResultsSection", () => ({
  CarsResultsSection: ({ isBrowsing, vehicles }: ResultsSectionMockProps) => (
    <>
      <p>{isBrowsing ? "검색 결과 모드" : "탐색 안내 모드"}</p>
      {isBrowsing && <p>결과 차량: {vehicles.map((item) => item.name).join(", ")}</p>}
    </>
  ),
}));

vi.mock("@/components/cars/CarsStickyFilterBar", () => ({
  CarsStickyFilterBar: () => null,
}));

vi.mock("./CarsPageSections", () => ({
  CarsPageHero: () => null,
  FeaturedVehiclesSection: () => <h2>지금 가장 많이 비교하는 모델</h2>,
}));

const vehicle: VehicleListItem = {
  id: "vehicle-1",
  slug: "test-suv",
  name: "테스트 SUV",
  brand: "현대",
  category: "SUV",
  basePrice: 40_000_000,
  evSubsidyRange: null,
  thumbnailUrl: "/test-suv.webp",
  isPopular: true,
  isSpotlight: true,
  description: null,
  displayOrder: 0,
  defaultTrim: null,
  monthlyFrom: 500_000,
  representativeQuotes: [],
  highlights: [],
  tags: [],
};

beforeEach(() => {
  class IntersectionObserverMock {
    observe() {}

    disconnect() {}
  }

  vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
  vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CarsClientPage 주목할 차량 노출", () => {
  it("검색어를 입력하면 주목할 차량을 접고, 검색을 지우면 다시 보여준다", () => {
    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    expect(screen.getByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).toBeInTheDocument();
    expect(screen.getByText("탐색 안내 모드")).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: "차량 검색" });
    fireEvent.change(searchInput, { target: { value: "테스트" } });

    expect(screen.queryByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).not.toBeInTheDocument();
    expect(screen.getByText("검색 결과 모드")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "" } });

    expect(screen.getByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).toBeInTheDocument();
  });

  it("필터로 결과를 탐색할 때도 주목할 차량을 접는다", () => {
    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "RV 필터" }));

    expect(screen.queryByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).not.toBeInTheDocument();
    expect(screen.getByText("검색 결과 모드")).toBeInTheDocument();
    expect(screen.getByText("결과 차량: 테스트 SUV")).toBeInTheDocument();
  });

  it("검색어를 연속 입력해도 입력값이 유지되고 history.replaceState로 URL만 갱신한다", async () => {
    vi.useFakeTimers();
    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    const searchInput = screen.getByRole("textbox", { name: "차량 검색" }) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "테" } });
    fireEvent.change(searchInput, { target: { value: "테스" } });
    fireEvent.change(searchInput, { target: { value: "테스트" } });

    // remount 없이 같은 input 인스턴스에 값이 유지되어야 한다
    expect(searchInput.value).toBe("테스트");
    expect(screen.getByRole("textbox", { name: "차량 검색" })).toBe(searchInput);

    await vi.advanceTimersByTimeAsync(250);

    expect(window.history.replaceState).toHaveBeenCalledWith(
      window.history.state,
      "",
      "/cars?query=%ED%85%8C%EC%8A%A4%ED%8A%B8",
    );

    vi.useRealTimers();
  });
});
