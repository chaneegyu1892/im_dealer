import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VehicleListItem } from "@/types/api";
import { CarCard } from "./CarCard";

type MockImageProps = ComponentProps<"img"> & {
  readonly fill?: boolean;
  readonly unoptimized?: boolean;
};

type MockMotionDivProps = ComponentProps<"div"> & {
  readonly initial?: unknown;
  readonly transition?: unknown;
  readonly viewport?: unknown;
  readonly whileInView?: unknown;
};

vi.mock("next/image", () => ({
  default: (props: MockImageProps) => (
    <span role="img" aria-label={props.alt} className={props.className} />
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: MockMotionDivProps) => <div className={props.className}>{props.children}</div>,
  },
}));

const vehicle: VehicleListItem = {
  id: "vehicle-1",
  slug: "test-sedan",
  name: "테스트 세단",
  brand: "현대",
  category: "세단",
  basePrice: 40_000_000,
  evSubsidyRange: null,
  thumbnailUrl: "/test-sedan.webp",
  isPopular: false,
  description: null,
  displayOrder: 0,
  defaultTrim: null,
  monthlyFrom: 0,
  representativeQuotes: [],
  highlights: [],
  tags: [],
};

describe("CarCard", () => {
  it("고정 이미지 영역을 채우도록 중앙 크롭한다", () => {
    render(<CarCard vehicle={vehicle} />);

    const image = screen.getByRole("img", { name: "현대 테스트 세단" });
    expect(image).toHaveClass("object-cover", "object-center");
    expect(image).not.toHaveClass("object-contain");
  });

  it("차량 포인트를 사진 아래에 두고 가격과 조건을 오른쪽 정렬한다", () => {
    render(
      <CarCard
        vehicle={{
          ...vehicle,
          name: "더 뉴 그랜저 HEV",
          defaultTrim: {
            name: "프리미엄",
            price: 45_000_000,
            engineType: "가솔린",
            fuelEfficiency: 16,
            specs: null,
          },
          representativeQuotes: [
            {
              productType: "장기렌트",
              monthlyPayment: 650_000,
              financeCompanyName: "테스트캐피탈",
            },
          ],
          highlights: ["가족과 장거리 이동에 적합한 넉넉한 실내 공간"],
          hashtags: ["#하이브리드", "#인기"],
        }}
      />,
    );

    const image = screen.getByRole("img", { name: "현대 더 뉴 그랜저 HEV" });
    const mediaColumn = image.parentElement?.parentElement;
    const hybridPoint = screen.getByText("#하이브리드");

    expect(mediaColumn).toContainElement(hybridPoint);
    expect(hybridPoint.parentElement?.previousElementSibling).toContainElement(image);
    expect(mediaColumn).toContainElement(screen.getByText("#프리미엄"));
    expect(screen.queryByText("#가솔린")).not.toBeInTheDocument();
    expect(screen.queryByText("가솔린 · 프리미엄")).not.toBeInTheDocument();
    expect(screen.queryByText("가족과 장거리 이동에 적합한 넉넉한 실내 공간")).not.toBeInTheDocument();

    const price = screen.getByText("65");
    expect(screen.getByRole("heading", { name: "더 뉴 그랜저 HEV" })).toHaveClass(
      "text-[20px]",
      "lg:text-[24px]",
      "xl:text-[26px]",
    );
    expect(price).toHaveClass("text-[30px]", "lg:text-[36px]", "xl:text-[38px]");
    expect(price.parentElement).toHaveClass("justify-end");
    expect(screen.getByText("60개월 · 연 2만km · 무보증")).toHaveClass("text-right");
    expect(screen.queryByText(/월 납입금/)).not.toBeInTheDocument();
  });
});
