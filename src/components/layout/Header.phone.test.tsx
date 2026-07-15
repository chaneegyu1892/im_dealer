import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getUser: vi.fn(async () => ({ data: { user: null } })),
  unsubscribe: vi.fn(),
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
});
