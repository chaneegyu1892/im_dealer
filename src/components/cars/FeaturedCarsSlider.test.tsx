import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { VehicleListItem } from "@/types/api";
import { FeaturedCarsSlider } from "./FeaturedCarsSlider";

type MockImageProps = ComponentProps<"img"> & {
  readonly fill?: boolean;
  readonly unoptimized?: boolean;
};

type MockMotionDivProps = ComponentProps<"div"> & {
  readonly initial?: unknown;
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
  isPopular: true,
  description: null,
  displayOrder: 0,
  defaultTrim: null,
  monthlyFrom: 0,
  representativeQuotes: [],
  highlights: [],
  tags: ["#인기", "#세단"],
};

describe("FeaturedCarsSlider 반응형 카드", () => {
  it("태블릿부터 2장과 확대 이미지 열을 함께 적용한다", () => {
    render(<FeaturedCarsSlider vehicles={[vehicle]} />);

    const vehicleLink = screen.getByRole("link", { name: /테스트 세단 현대 인기/ });
    const grid = vehicleLink.firstElementChild;
    const slide = vehicleLink.parentElement?.parentElement;

    expect(slide).toHaveClass("w-[calc(100%-4px)]", "md:w-[calc(50%-10px)]");
    expect(slide).not.toHaveClass("sm:w-[calc(50%-10px)]");
    expect(grid).toHaveClass(
      "grid-cols-[38%_1fr]",
      "md:grid-cols-[46%_1fr]",
      "lg:grid-cols-[48%_1fr]",
    );
  });
});
