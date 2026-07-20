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

describe("CarCard 차량 이미지", () => {
  it("고정 이미지 영역을 채우도록 중앙 크롭한다", () => {
    render(<CarCard vehicle={vehicle} />);

    const image = screen.getByRole("img", { name: "현대 테스트 세단" });
    expect(image).toHaveClass("object-cover", "object-center");
    expect(image).not.toHaveClass("object-contain");
  });
});
