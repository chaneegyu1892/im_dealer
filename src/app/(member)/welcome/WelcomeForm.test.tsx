import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeForm } from "./WelcomeForm";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  fetch: vi.fn(),
}));

const originalFetch = globalThis.fetch;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

function renderForm() {
  return render(
    <WelcomeForm defaultName="" defaultPhone="" next="/" />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.replace.mockReset();
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  } as unknown as Response);
  globalThis.fetch = mocks.fetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("WelcomeForm", () => {
  it("추천인 코드(선택) 입력 필드를 렌더한다", () => {
    renderForm();

    const input = screen.getByPlaceholderText("추천인 코드(선택)");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("maxlength", "5");
  });

  it("입력값을 대문자로 정규화한다", () => {
    renderForm();

    const input = screen.getByPlaceholderText("추천인 코드(선택)");
    fireEvent.change(input, { target: { value: "a1b23" } });

    expect(input).toHaveValue("A1B23");
  });

  it("제출 시 referralCode 를 POST body 에 포함한다", async () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText("추천인 코드(선택)"), {
      target: { value: "a1234" },
    });
    fireEvent.change(screen.getByPlaceholderText("홍길동"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByPlaceholderText("010-1234-5678"), {
      target: { value: "010-1234-5678" },
    });

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = mocks.fetch.mock.calls[0];

    expect(url).toBe("/api/auth/complete-profile");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ referralCode: "A1234" });
  });

  it("코드를 비워두면 body 에 referralCode 를 싣지 않는다", async () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText("홍길동"), {
      target: { value: "홍길동" },
    });
    fireEvent.change(screen.getByPlaceholderText("010-1234-5678"), {
      target: { value: "010-1234-5678" },
    });

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (mocks.fetch.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body).not.toHaveProperty("referralCode");
  });

  it("제출 성공 시 원래 목적지로 이동한다", async () => {
    render(
      <WelcomeForm defaultName="홍" defaultPhone="010-1234-5678" next="/cars" />
    );

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/cars"));
  });
});
