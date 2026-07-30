import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WelcomePage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

describe("WelcomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      name: "회원",
      kakaoNickname: "카카오회원",
      phone: null,
      profileCompleted: false,
    });
  });

  it("protocol-relative next 값을 내부 기본 경로로 대체한다", async () => {
    const page = await WelcomePage({
      searchParams: Promise.resolve({ next: "//attacker.example/path" }),
    }) as ReactElement<{ next: string }>;

    expect(page.props.next).toBe("/");
  });

  it("가입 완료 회원도 protocol-relative next 로 외부 리다이렉트하지 않는다", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      name: "홍길동",
      kakaoNickname: "길동",
      phone: "010-1234-5678",
      profileCompleted: true,
    });

    await WelcomePage({
      searchParams: Promise.resolve({ next: "//attacker.example/path" }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith("/");
    expect(mocks.redirect).not.toHaveBeenCalledWith("//attacker.example/path");
  });
});
