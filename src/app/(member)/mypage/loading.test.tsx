import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import MyPageLoading from "./loading";

// (member)/mypage/loading.tsx — 기존 (public)/loading.tsx 의 스피너 톤을 따르는지 고정.
describe("mypage loading.tsx", () => {
  it("스피너와 '불러오는 중...' 문구를 렌더한다", () => {
    const { container } = render(<MyPageLoading />);

    expect(screen.getByText("불러오는 중...")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
