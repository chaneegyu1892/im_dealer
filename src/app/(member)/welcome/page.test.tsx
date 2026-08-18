import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WelcomePage from "./page";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
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
    mocks.cookies.mockResolvedValue({ get: () => undefined });
  });

  it("protocol-relative next 값을 내부 기본 경로로 대체한다", async () => {
    const page = await WelcomePage({
      searchParams: Promise.resolve({ next: "//attacker.example/path" }),
    }) as ReactElement<{ next: string }>;

    expect(page.props.next).toBe("/");
  });

  it("추천 쿠키가 있으면 정규화된 코드를 defaultReferralCode 로 전달한다", async () => {
    mocks.cookies.mockResolvedValue({
      get: (name: string) =>
        name === "referral_code" ? { name, value: "k4821" } : undefined,
    });

    const page = (await WelcomePage({
      searchParams: Promise.resolve({}),
    })) as ReactElement<{ defaultReferralCode: string }>;

    expect(page.props.defaultReferralCode).toBe("K4821");
  });

  it("추천 쿠키가 없으면 defaultReferralCode 는 빈 문자열이다", async () => {
    const page = (await WelcomePage({
      searchParams: Promise.resolve({}),
    })) as ReactElement<{ defaultReferralCode: string }>;

    expect(page.props.defaultReferralCode).toBe("");
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
