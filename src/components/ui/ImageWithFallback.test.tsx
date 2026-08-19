import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { ImageWithFallback } from "./ImageWithFallback";

describe("ImageWithFallback", () => {
  it("이미지 로드가 실패하면 깨진 이미지 대신 폴백을 그린다", () => {
    render(<ImageWithFallback src="/gone.webp" alt="테스트 차량" fill />);

    fireEvent.error(screen.getByRole("img", { name: "테스트 차량" }));

    expect(
      screen.getByRole("img", { name: "테스트 차량 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(screen.getByText("이미지 준비 중")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("주소가 비어 있으면 처음부터 폴백을 그린다", () => {
    const { rerender } = render(<ImageWithFallback src={null} alt="테스트 차량" fill />);

    expect(
      screen.getByRole("img", { name: "테스트 차량 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();

    rerender(<ImageWithFallback src="" alt="테스트 차량" fill />);

    expect(
      screen.getByRole("img", { name: "테스트 차량 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("실패한 주소가 다른 주소로 바뀌면 폴백을 풀고 다시 시도한다", () => {
    const { rerender } = render(<ImageWithFallback src="/gone.webp" alt="테스트 차량" fill />);

    fireEvent.error(screen.getByRole("img", { name: "테스트 차량" }));
    expect(document.querySelector("img")).toBeNull();

    rerender(<ImageWithFallback src="/live.webp" alt="테스트 차량" fill />);

    expect(screen.getByRole("img", { name: "테스트 차량" })).toHaveAttribute(
      "src",
      "/live.webp",
    );
    expect(
      screen.queryByRole("img", { name: "테스트 차량 이미지를 불러올 수 없음" }),
    ).not.toBeInTheDocument();
  });

  it("같은 주소로 다시 그려도 깨진 이미지를 되살리지 않는다", () => {
    const { rerender } = render(<ImageWithFallback src="/gone.webp" alt="테스트 차량" fill />);

    fireEvent.error(screen.getByRole("img", { name: "테스트 차량" }));
    rerender(<ImageWithFallback src="/gone.webp" alt="테스트 차량" fill />);

    expect(
      screen.getByRole("img", { name: "테스트 차량 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("좁은 칸에서는 안내 문구 없이 폴백 아이콘만 남긴다", () => {
    render(
      <ImageWithFallback
        src="/gone.webp"
        alt="썸네일 1"
        width={96}
        height={54}
        fallbackLabel={null}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "썸네일 1" }));

    expect(
      screen.getByRole("img", { name: "썸네일 1 이미지를 불러올 수 없음" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("이미지 준비 중")).not.toBeInTheDocument();
  });
});
