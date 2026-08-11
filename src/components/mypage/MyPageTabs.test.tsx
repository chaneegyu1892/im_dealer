import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: mocks.usePathname }));

import { MyPageTabs } from "./MyPageTabs";

describe("MyPageTabs", () => {
  beforeEach(() => mocks.usePathname.mockReset());

  it("현재 경로의 탭에 aria-current 를 준다", () => {
    mocks.usePathname.mockReturnValue("/mypage/coupons");
    render(<MyPageTabs />);

    expect(screen.getByRole("link", { name: "쿠폰함" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "추천인" })).toHaveAttribute("href", "/mypage/referral");
    expect(screen.getByRole("link", { name: "내 견적" })).toHaveAttribute("href", "/mypage/quotes");
    expect(screen.getByRole("link", { name: "내 정보" })).toHaveAttribute("href", "/mypage/profile");
  });

  it("마이페이지 루트에서는 홈 탭이 활성이다", () => {
    mocks.usePathname.mockReturnValue("/mypage");
    render(<MyPageTabs />);

    expect(screen.getByRole("link", { name: "홈" })).toHaveAttribute("aria-current", "page");
  });
});

