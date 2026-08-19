import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LegacyRecommendedVehicle, RecommendScenario } from "@/types/recommendation";

type MockImageProps = ComponentProps<"img"> & {
  readonly fill?: boolean;
  readonly priority?: boolean;
  readonly unoptimized?: boolean;
};

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ fill, priority, unoptimized, ...props }: MockImageProps) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/useAuthUser", () => ({
  useAuthUser: () => ({ user: { id: "user-1" }, isLoading: false }),
}));

import { RecommendVehicleCard } from "./RecommendVehicleCard";

const SURCHARGE_NOTE = "금융사 순위 가산 포함";

function scenario(overrides: Partial<RecommendScenario> = {}): RecommendScenario {
  return {
    monthlyPayment: 650_000,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 60,
    annualMileage: 20_000,
    contractType: "반납형",
    ...overrides,
  };
}

function vehicleFixture(
  standard: RecommendScenario = scenario(),
): LegacyRecommendedVehicle {
  return {
    vehicleId: "vehicle-1",
    rank: 1,
    score: 90,
    reason: "출퇴근 조건에 잘 맞는 차량입니다.",
    highlights: ["고연비"],
    estimatedMonthly: standard.monthlyPayment,
    scenarios: {
      conservative: scenario({ monthlyPayment: 520_000, depositAmount: 8_000_000 }),
      standard,
      aggressive: scenario({ monthlyPayment: 430_000, prepayAmount: 12_000_000 }),
    },
    vehicle: {
      name: "테스트 차량",
      brand: "현대",
      category: "SUV",
      thumbnailUrl: "/gone.webp",
      imageUrls: [],
      defaultTrimName: "프리미엄",
      defaultTrimPrice: 40_000_000,
      slug: "test-car",
      popularConfigs: [],
    },
  };
}

describe("RecommendVehicleCard 이미지 폴백", () => {
  it("썸네일 로드가 실패하면 깨진 이미지 대신 폴백을 보여준다", () => {
    render(<RecommendVehicleCard vehicle={vehicleFixture()} />);

    fireEvent.error(screen.getByRole("img", { name: "테스트 차량" }));

    expect(
      screen.getByRole("img", { name: "테스트 차량 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("썸네일 주소가 비어 있으면 처음부터 폴백을 보여준다", () => {
    const vehicle = vehicleFixture();
    render(
      <RecommendVehicleCard
        vehicle={{ ...vehicle, vehicle: { ...vehicle.vehicle, thumbnailUrl: "", imageUrls: [] } }}
      />,
    );

    expect(
      screen.getByRole("img", { name: "테스트 차량 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("RecommendVehicleCard 순위 가산 표기", () => {
  it("가산이 반영된 금액에는 그 사실을 한 번 밝힌다", () => {
    render(<RecommendVehicleCard vehicle={vehicleFixture()} />);

    expect(screen.getByText(SURCHARGE_NOTE)).toBeInTheDocument();
  });

  it("표시할 견적 금액이 없으면 가산 표기를 붙이지 않는다", () => {
    render(<RecommendVehicleCard vehicle={vehicleFixture(scenario({ monthlyPayment: 0 }))} />);

    expect(screen.queryByText(SURCHARGE_NOTE)).not.toBeInTheDocument();
  });

  it("잠긴 금액에는 가산 표기를 붙이지 않는다", () => {
    render(
      <RecommendVehicleCard
        vehicle={vehicleFixture(scenario({ monthlyPayment: 650_000, locked: true }))}
      />,
    );

    expect(screen.queryByText(SURCHARGE_NOTE)).not.toBeInTheDocument();
  });
});
