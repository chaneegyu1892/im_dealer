import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteClientPageV2 } from "./QuoteClientPageV2";
import type { VehicleListItem } from "@/types/api";

const navigationMock = vi.hoisted(() => ({
  router: {
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  },
  searchParams: new URLSearchParams("vehicle=preparing-car&customerType=individual&restore=1"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationMock.router,
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

const vehicles = [
  {
    id: "vehicle-preparing",
    slug: "preparing-car",
    name: "준비중 차량",
    brand: "아임",
    category: "SUV",
    basePrice: 40_000_000,
    evSubsidyRange: null,
    thumbnailUrl: "",
    isPopular: false,
    description: null,
    displayOrder: 1,
    defaultTrim: {
      name: "프리미엄",
      price: 40_000_000,
      engineType: "가솔린",
      fuelEfficiency: null,
      specs: null,
    },
    monthlyFrom: 0,
    highlights: [],
    tags: [],
  },
] satisfies VehicleListItem[];

function writeConsultationRestore(): void {
  window.localStorage.setItem(
    "quote_image_restore",
    JSON.stringify({
      vehicleSlug: "preparing-car",
      customerType: "individual",
      selectedLineup: null,
      selectedTrimName: null,
      selectedOptionIds: [],
      contractCategory: "장기렌트",
      conditions: {
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
      },
      customRates: { depositRate: 0, prepayRate: 0 },
      costMode: "none",
      quoteResult: {
        vehicleSlug: "preparing-car",
        trimId: "trim-preparing",
        trimName: "프리미엄",
        trimPrice: 40_000_000,
        optionsTotalPrice: 0,
        colorDelta: 0,
        totalVehiclePrice: 40_000_000,
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        customerType: "individual",
        scenarios: {},
        requiresConsultation: true,
      },
    })
  );
}

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  navigationMock.searchParams = new URLSearchParams("vehicle=preparing-car&customerType=individual&restore=1");
  navigationMock.router.back.mockReset();
  navigationMock.router.push.mockReset();
  navigationMock.router.replace.mockReset();
});

describe("QuoteClientPageV2 consultation fallback", () => {
  it("keeps the quote result summary and shows consultation guidance when scenarios are missing", async () => {
    writeConsultationRestore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true, data: [] }))
    );

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    await screen.findByText("이 차량은 별도 상담이 필요합니다");

    expect(screen.getByText("준비중 차량")).toBeInTheDocument();
    expect(screen.getByText("프리미엄")).toBeInTheDocument();
    expect(screen.getByText("상품")).toBeInTheDocument();
    expect(screen.getByText("장기렌트")).toBeInTheDocument();
    expect(screen.getByText("계약기간")).toBeInTheDocument();
    expect(screen.getByText("60개월")).toBeInTheDocument();
    expect(screen.getByText("약정거리")).toBeInTheDocument();
    expect(screen.getByText("연 2만km")).toBeInTheDocument();
    expect(screen.getByText("월 납입금")).toBeInTheDocument();
    expect(screen.getByText("별도 상담 필요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상담하기" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("문제가 발생했습니다")).not.toBeInTheDocument();
    });
  });

  it("continues to consultation result when the selected vehicle has no trims", async () => {
    navigationMock.searchParams = new URLSearchParams("vehicle=preparing-car&customerType=individual");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.endsWith("/colors")) {
          return Response.json({ success: true, data: [] });
        }
        if (url.endsWith("/trims")) {
          return Response.json({ success: true, data: [] });
        }
        if (url.endsWith("/quote")) {
          return Response.json({
            success: true,
            data: {
              vehicleSlug: "preparing-car",
              trimId: "",
              trimName: "",
              trimPrice: 40_000_000,
              optionsTotalPrice: 0,
              colorDelta: 0,
              totalVehiclePrice: 40_000_000,
              contractMonths: 60,
              annualMileage: 20000,
              contractType: "반납형",
              customerType: "individual",
              scenarios: {},
              requiresConsultation: true,
            },
          });
        }
        return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
      })
    );

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    const submit = await screen.findByRole("button", { name: "상담 필요 견적 확인하기" });
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    await screen.findByText("이 차량은 별도 상담이 필요합니다");
    expect(screen.getByText("준비중 차량")).toBeInTheDocument();
    expect(screen.getByText("월 납입금")).toBeInTheDocument();
    expect(screen.getByText("별도 상담 필요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "상담하기" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("트림을 선택하세요")).not.toBeInTheDocument();
    });
  });
});
