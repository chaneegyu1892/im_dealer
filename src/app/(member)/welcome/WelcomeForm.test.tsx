import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeForm } from "./WelcomeForm";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

function renderForm(defaultReferralCode = "") {
  return render(
    <WelcomeForm
      defaultName="홍길동"
      defaultPhone="010-1234-5678"
      next="/"
      defaultReferralCode={defaultReferralCode}
    />,
  );
}

describe("WelcomeForm 추천인 코드", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("기본은 입력란이 접혀 있고 토글 버튼만 보인다", () => {
    renderForm();
    expect(screen.queryByLabelText(/추천인 코드/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /추천인 코드가 있나요/ }),
    ).toBeInTheDocument();
  });

  it("토글을 누르면 입력란이 펼쳐진다", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /추천인 코드가 있나요/ }));
    expect(screen.getByLabelText(/추천인 코드/)).toBeInTheDocument();
  });

  it("추천 쿠키로 받은 코드는 펼쳐진 채 자동 입력된다", () => {
    renderForm("K4821");
    const input = screen.getByLabelText(/추천인 코드/) as HTMLInputElement;
    expect(input.value).toBe("K4821");
    expect(screen.getByText(/자동 입력됐어요/)).toBeInTheDocument();
  });

  it("형식이 잘못된 코드는 제출을 막고 에러를 보여준다", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /추천인 코드가 있나요/ }));
    fireEvent.change(screen.getByLabelText(/추천인 코드/), {
      target: { value: "AB123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    expect(await screen.findByText(/형식이 올바르지 않습니다/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("소문자 입력도 대문자로 정규화해 body 에 포함한다", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /추천인 코드가 있나요/ }));
    fireEvent.change(screen.getByLabelText(/추천인 코드/), {
      target: { value: "b7777" },
    });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.referralCode).toBe("B7777");
  });

  it("코드를 입력하지 않으면 body 에 referralCode 를 넣지 않는다", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect("referralCode" in body).toBe(false);
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });
});
