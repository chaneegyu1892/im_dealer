import type { ComponentProps, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type MockImageProps = ComponentProps<"img"> & {
  readonly fill?: boolean;
  readonly priority?: boolean;
  readonly unoptimized?: boolean;
};

type MockMotionProps = {
  readonly children?: ReactNode;
  readonly className?: string;
};

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ fill, priority, unoptimized, ...props }: MockImageProps) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: MockMotionProps) => <>{children}</>,
  motion: {
    section: ({ children, className }: MockMotionProps) => (
      <section className={className}>{children}</section>
    ),
    div: ({ children, className }: MockMotionProps) => (
      <div className={className}>{children}</div>
    ),
  },
}));

import { CarImageGallery } from "./CarImageGallery";

describe("CarImageGallery", () => {
  it("대표 이미지 로드가 실패하면 깨진 이미지 대신 폴백을 보여준다", () => {
    render(<CarImageGallery vehicleName="테스트 차량" images={["/gone.webp", "/second.webp"]} />);

    fireEvent.error(screen.getByRole("img", { name: "테스트 차량 이미지 1" }));

    expect(
      screen.getByRole("img", { name: "테스트 차량 이미지 1 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "테스트 차량 이미지 1" })).not.toBeInTheDocument();
  });

  it("썸네일 로드가 실패해도 해당 칸만 폴백으로 대체한다", () => {
    render(<CarImageGallery vehicleName="테스트 차량" images={["/gone.webp", "/second.webp"]} />);

    fireEvent.error(screen.getByRole("img", { name: "썸네일 2" }));

    expect(
      screen.getByRole("img", { name: "썸네일 2 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "썸네일 1" })).toBeInTheDocument();
  });
});
