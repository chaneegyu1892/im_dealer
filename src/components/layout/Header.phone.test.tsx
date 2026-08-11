import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getUser: vi.fn(),
  unsubscribe: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mocks.getUser,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: mocks.unsubscribe } },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  }),
}));

describe("Header 대표전화 · My 메뉴", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.fetch.mockReset();
    mocks.push.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("전화 아이콘을 누르면 대표번호와 발신 링크를 보여준다", () => {
    render(<Header />);

    const trigger = screen.getByRole("button", { name: "대표전화 보기" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("1688-8479")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("대표전화")).toBeInTheDocument();
    expect(screen.getByText("1688-8479")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /1688-8479 전화 걸기/ })).toHaveAttribute(
      "href",
      "tel:16888479",
    );
  });

  it("ESC 키를 누르면 대표전화 패널이 닫히고 포커스가 트리거로 돌아온다", () => {
    render(<Header />);

    const trigger = screen.getByRole("button", { name: "대표전화 보기" });
    fireEvent.click(trigger);
    expect(screen.getByText("1688-8479")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("1688-8479")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("닫기 버튼을 누르면 대표전화 패널이 닫히고 포커스가 트리거로 돌아온다", () => {
    render(<Header />);

    const trigger = screen.getByRole("button", { name: "대표전화 보기" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "대표전화 닫기" }));

    expect(screen.queryByText("1688-8479")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("비로그인 My 버튼은 로그인으로 보낸다", () => {
    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(mocks.push).toHaveBeenCalledWith(expect.stringContaining("/login?next="));
  });

  it("로그인 회원 My 메뉴에 아이콘 메뉴 항목이 있다", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "test@example.com",
          user_metadata: { name: "테스트 고객" },
        },
      },
    });
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { role: "member" } }),
    });
    render(<Header />);

    const myButton = await screen.findByRole("button", { name: "My 메뉴 열기" });
    fireEvent.click(myButton);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "내 견적보기" })).toHaveAttribute(
        "href",
        "/mypage/quotes",
      );
    });
    expect(screen.getByRole("menuitem", { name: "추천인 페이지" })).toHaveAttribute(
      "href",
      "/mypage/referral",
    );
    expect(screen.getByRole("menuitem", { name: "쿠폰함" })).toHaveAttribute(
      "href",
      "/mypage/coupons",
    );
    expect(screen.getByRole("menuitem", { name: "내 정보" })).toHaveAttribute(
      "href",
      "/mypage/profile",
    );
    expect(screen.getByRole("menuitem", { name: "로그아웃" })).toBeInTheDocument();
  });
});
