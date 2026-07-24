import { fireEvent, render, screen } from "@testing-library/react";
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
    },
  }),
}));

describe("Header 대표전화", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.fetch.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("전화 아이콘을 누르면 대표번호와 발신 링크를 보여준다", () => {
    render(<Header />);

    const trigger = screen.getByRole("button", { name: "대표전화 보기" });
    expect(screen.queryByText("1688-8479")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByText("대표전화")).toBeInTheDocument();
    expect(screen.getByText("1688-8479")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1688-8479 전화 걸기" })).toHaveAttribute(
      "href",
      "tel:16888479",
    );
  });

  it("로그인 회원 메뉴에서 마이페이지로 이동할 수 있다", async () => {
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          email: "member@example.com",
          user_metadata: { name: "테스트 고객" },
        },
      },
    });
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { role: "member" } }),
    });
    render(<Header />);

    const profileButton = await screen.findByRole("button", { name: "테스트 고객 계정 메뉴" });
    const header = screen.getByRole("banner");

    expect(header).toHaveClass("z-50");
    fireEvent.click(profileButton);

    expect(header).toHaveClass("z-[70]");
    expect(screen.getByRole("menuitem", { name: "마이페이지" })).toHaveAttribute(
      "href",
      "/mypage"
    );
  });
});
