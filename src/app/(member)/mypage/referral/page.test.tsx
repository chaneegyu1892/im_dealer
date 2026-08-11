import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReferralPage from "./page";

const mocks = vi.hoisted(() => ({
  requireMember: vi.fn(),
  getReferralPageData: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/require-access", () => ({
  requireMember: mocks.requireMember,
}));

vi.mock("@/lib/member-queries/referral", () => ({
  getReferralPageData: mocks.getReferralPageData,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

const pageData = {
  code: "A1234",
  link: "https://imdealer.example/r/A1234",
  monthlyCount: 3,
  remainingQuota: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  mocks.requireMember.mockResolvedValue({ userId: "supabase-1" });
  mocks.getReferralPageData.mockResolvedValue(pageData);
});

describe("ReferralPage", () => {
  it("회원에게 코드·링크·이번 달 추천 수를 렌더링한다", async () => {
    const result = await ReferralPage();
    render(result);

    expect(screen.getByText("A1234")).toBeInTheDocument();
    expect(screen.getByText("https://imdealer.example/r/A1234")).toBeInTheDocument();
    expect(screen.getByText("3회")).toBeInTheDocument();
    expect(screen.getByText("7회")).toBeInTheDocument();
    expect(mocks.requireMember).toHaveBeenCalledTimes(1);
    expect(mocks.getReferralPageData).toHaveBeenCalledWith("supabase-1");
  });

  it("공유 링크 복사 버튼이 있다", async () => {
    const result = await ReferralPage();
    render(result);

    expect(
      screen.getByRole("button", { name: "공유 링크 복사" })
    ).toBeInTheDocument();
  });

  it("추천인 제도 약관 텍스트가 있다", async () => {
    const result = await ReferralPage();
    render(result);

    expect(screen.getByText("추천인 제도 안내")).toBeInTheDocument();
    expect(screen.getByText(/자기 자신을 추천할 수 없어요/)).toBeInTheDocument();
    expect(screen.getByText(/최대 10회/)).toBeInTheDocument();
    expect(screen.getByText(/5만원/)).toBeInTheDocument();
    expect(screen.getByText(/3만원/)).toBeInTheDocument();
  });

  it("로그인하지 않은 회원은 로그인으로 리다이렉트된다", async () => {
    mocks.requireMember.mockResolvedValue({ userId: null });

    await expect(ReferralPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
    expect(mocks.getReferralPageData).not.toHaveBeenCalled();
  });

  it("카운트가 한도를 넘어도 남은 한도는 0 아래로 떨어지지 않는다", async () => {
    mocks.getReferralPageData.mockResolvedValue({
      ...pageData,
      monthlyCount: 10,
      remainingQuota: 0,
    });

    const result = await ReferralPage();
    render(result);

    expect(screen.getByText("0회")).toBeInTheDocument();
  });
});
