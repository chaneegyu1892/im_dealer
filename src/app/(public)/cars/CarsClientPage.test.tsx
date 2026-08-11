import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleListItem } from "@/types/api";
import {
  CarsClientPage,
  isElectricEngine,
  isElectricOnlyVehicle,
} from "./CarsClientPage";

type FilterPanelMockProps = {
  readonly searchQuery: string;
  readonly onSearchChange: (value: string) => void;
  readonly onCategoryChange: (category: "SUV") => void;
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
  VEHICLE_CATEGORIES: ["전체", "세단", "SUV", "밴", "전기차"],
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
      <button type="button" onClick={() => onCategoryChange("SUV")}>
        SUV 필터
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
  publicTrims: [{ engineType: "가솔린" }],
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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("전기차 필터", () => {
  it("공개 트림이 모두 전기인 차량만 포함한다", () => {
    expect(isElectricEngine("EV")).toBe(true);
    expect(isElectricEngine("전기")).toBe(true);
    expect(isElectricEngine("가솔린")).toBe(false);

    expect(isElectricOnlyVehicle({ publicTrims: [{ engineType: "EV" }, { engineType: "EV" }] })).toBe(true);
    expect(isElectricOnlyVehicle({ publicTrims: [{ engineType: "EV" }, { engineType: "가솔린" }] })).toBe(false);
    expect(isElectricOnlyVehicle({ publicTrims: [{ engineType: "가솔린" }] })).toBe(false);
  });
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

    fireEvent.click(screen.getByRole("button", { name: "SUV 필터" }));

    expect(screen.queryByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).not.toBeInTheDocument();
    expect(screen.getByText("검색 결과 모드")).toBeInTheDocument();
    expect(screen.getByText("결과 차량: 테스트 SUV")).toBeInTheDocument();
  });
});

const FILTERS_STORAGE_KEY = "imdealer:cars-filters";
const SCROLL_STORAGE_KEY = "imdealer:cars-scroll";

describe("필터/스크롤 상태 세션 복원", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("저장된 값이 없으면 기본 필터 상태로 렌더링한다", () => {
    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    // 기본 상태(전체/전체/인기순)에서는 탐색 안내 모드가 노출된다.
    expect(screen.getByText("탐색 안내 모드")).toBeInTheDocument();
  });

  it("세션에 저장된 유효한 필터를 초기값으로 복원한다", () => {
    window.sessionStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify({ category: "SUV", brand: "현대", sort: "price-asc" }),
    );

    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    // 저장된 카테고리 필터(SUV, 전체 아님)로 즉시 탐색 모드가 활성화된다.
    expect(screen.getByText("검색 결과 모드")).toBeInTheDocument();
    expect(screen.getByText("결과 차량: 테스트 SUV")).toBeInTheDocument();
  });

  it("손상된 JSON이나 유효하지 않은 값은 기본값으로 무시한다", () => {
    window.sessionStorage.setItem(FILTERS_STORAGE_KEY, "{not-json");

    expect(() => render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />)).not.toThrow();
    expect(screen.getByText("탐색 안내 모드")).toBeInTheDocument();

    window.sessionStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify({ category: "존재하지않는카테고리", brand: "현대", sort: "popular" }),
    );

    expect(() => render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />)).not.toThrow();
  });

  it("필터 변경 시 세션 스토리지에 저장한다", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "SUV 필터" }));

    expect(setItemSpy).toHaveBeenCalledWith(
      FILTERS_STORAGE_KEY,
      JSON.stringify({ category: "SUV", brand: "전체", sort: "popular" }),
    );

    setItemSpy.mockRestore();
  });

  it("sessionStorage 접근이 예외를 던져도 크래시하지 않고 기본값을 사용한다", () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    expect(() => render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />)).not.toThrow();
    expect(screen.getByText("탐색 안내 모드")).toBeInTheDocument();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it("저장된 스크롤 위치가 있으면 마운트 시 복원한다", () => {
    window.sessionStorage.setItem(SCROLL_STORAGE_KEY, "480");
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    expect(scrollToSpy).toHaveBeenCalledWith(0, 480);

    scrollToSpy.mockRestore();
  });
});
