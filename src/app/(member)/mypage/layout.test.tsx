import { beforeEach, describe, expect, it, vi } from "vitest";
import MyPageLayout from "./layout";

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

describe("MyPageLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("가입 미완료 회원을 welcome 화면으로 보낸다", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      role: "member",
      profileCompleted: false,
    });

    await MyPageLayout({ children: <div>마이페이지</div> });

    expect(mocks.redirect).toHaveBeenCalledWith("/welcome?next=%2Fmypage");
  });

  it("가입 완료 회원은 마이페이지를 렌더링한다", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      role: "member",
      profileCompleted: true,
    });

    const result = await MyPageLayout({ children: <div>마이페이지</div> });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(result).toEqual(<div>마이페이지</div>);
  });
});
