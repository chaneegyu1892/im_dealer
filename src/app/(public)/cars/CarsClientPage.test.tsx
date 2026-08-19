import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

/** 타이머 없이 마이크로태스크만 배수해 이펙트-fetch 라운드를 결정론적으로 진행시킨다. */
async function settle(rounds = 12) {
  for (let index = 0; index < rounds; index += 1) {
    await act(async () => {
      for (let tick = 0; tick < 4; tick += 1) {
        await Promise.resolve();
      }
    });
  }
}

describe("CarsClientPage 주목할 차량 노출", () => {
  it("검색어를 입력하면 주목할 차량을 접고, 검색을 지우면 다시 보여준다", async () => {
    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    expect(screen.getByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).toBeInTheDocument();
    expect(screen.getByText("탐색 안내 모드")).toBeInTheDocument();

    const searchInput = screen.getByRole("textbox", { name: "차량 검색" });
    fireEvent.change(searchInput, { target: { value: "테스트" } });

    expect(screen.queryByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).not.toBeInTheDocument();
    expect(screen.getByText("검색 결과 모드")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "" } });

    expect(screen.getByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).toBeInTheDocument();
    // 대표견적 지연 로드(실패 → 재시도 1회)가 테스트 밖에서 끝나지 않도록 배수한다.
    await settle(3);
  });

  it("필터로 결과를 탐색할 때도 주목할 차량을 접는다", async () => {
    render(<CarsClientPage vehicles={[vehicle]} brandSignals={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "RV 필터" }));

    expect(screen.queryByRole("heading", { name: "지금 가장 많이 비교하는 모델" })).not.toBeInTheDocument();
    expect(screen.getByText("검색 결과 모드")).toBeInTheDocument();
    expect(screen.getByText("결과 차량: 테스트 SUV")).toBeInTheDocument();
    await settle(3);
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

    await settle(3);
    vi.useRealTimers();
  });
});

describe("CarsClientPage 대표견적 지연 로드", () => {
  /** 서버 route 의 MAX_IDS 와 동일. 초과분은 응답에서 조용히 잘린다. */
  const SERVER_MAX_IDS = 80;

  function makeVehicle(overrides: Partial<VehicleListItem> & { readonly id: string }): VehicleListItem {
    return {
      ...vehicle,
      slug: `slug-${overrides.id}`,
      name: `테스트 차량 ${overrides.id}`,
      isPopular: false,
      isSpotlight: false,
      monthlyFrom: 0,
      ...overrides,
    };
  }

  function requestedIds(mock: ReturnType<typeof vi.fn>): string[][] {
    return mock.mock.calls.map(([url]) => {
      const query = new URL(String(url), "http://localhost").searchParams.get("ids") ?? "";
      return query.split(",").filter(Boolean);
    });
  }

  function jsonResponse(data: Record<string, { representativeQuotes: []; monthlyFrom: number }>) {
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  /**
   * 실제 route 흉내: 중복 제거 후 앞에서 MAX_IDS 개만 처리하고,
   * 숨김(isVisible=false) 차량 id 는 응답에서 빠진다.
   */
  function serverLikeFetch(hiddenIds: readonly string[] = []) {
    return vi.fn(async (url: string) => {
      const ids = (new URL(String(url), "http://localhost").searchParams.get("ids") ?? "")
        .split(",")
        .filter(Boolean)
        .slice(0, SERVER_MAX_IDS)
        .filter((id) => !hiddenIds.includes(id));
      return jsonResponse(
        Object.fromEntries(
          ids.map((id) => [id, { representativeQuotes: [] as [], monthlyFrom: 500_000 }]),
        ),
      );
    });
  }

  function searchAll() {
    fireEvent.change(screen.getByRole("textbox", { name: "차량 검색" }), {
      target: { value: "테스트" },
    });
  }

  it("100대 목록은 서버 상한(80) 이하 청크로 나눠 요청하고 호출 횟수가 유한하다", async () => {
    const fetchMock = serverLikeFetch();
    vi.stubGlobal("fetch", fetchMock);
    const vehicles = Array.from({ length: 100 }, (_, index) =>
      makeVehicle({ id: `vehicle-${index}` }),
    );

    render(<CarsClientPage vehicles={vehicles} brandSignals={{}} />);
    searchAll();
    await settle();

    const batches = requestedIds(fetchMock);
    expect(batches.every((ids) => ids.length <= SERVER_MAX_IDS)).toBe(true);
    expect(new Set(batches.flat()).size).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("서버가 끝내 돌려주지 않는 id 가 있어도 재요청 루프를 돌지 않는다", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CarsClientPage vehicles={[makeVehicle({ id: "ghost-1" })]} brandSignals={{}} />,
    );
    searchAll();
    await settle();

    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("API 가 500 이면 재시도 1회 후 멈춘다", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CarsClientPage vehicles={[makeVehicle({ id: "vehicle-500" })]} brandSignals={{}} />,
    );
    searchAll();
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("응답이 지연되는 동안에는 같은 id 를 중복 발사하지 않는다", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CarsClientPage vehicles={[makeVehicle({ id: "slow-1" })]} brandSignals={{}} />,
    );
    searchAll();
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("숨김(isVisible=false) 차량 id 는 요청에 포함하지 않는다", async () => {
    const fetchMock = serverLikeFetch(["hidden-1"]);
    vi.stubGlobal("fetch", fetchMock);
    const vehicles = [
      makeVehicle({ id: "visible-1" }),
      makeVehicle({ id: "hidden-1", isVisible: false }),
    ];

    render(<CarsClientPage vehicles={vehicles} brandSignals={{}} />);
    searchAll();
    await settle();

    const requested = requestedIds(fetchMock).flat();
    expect(requested).toContain("visible-1");
    expect(requested).not.toContain("hidden-1");
  });
});
