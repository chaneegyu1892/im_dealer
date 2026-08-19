import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import PublicError from "./error";

const makeError = (digest?: string) => {
  const err = new Error("boom") as Error & { digest?: string };
  if (digest) err.digest = digest;
  return err;
};

// (public) 세그먼트 error.tsx — 루트 error.tsx 와 같은 문구 체계/버튼을 쓰는지 고정.
describe("(public) error.tsx 세그먼트 에러 바운더리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("마운트 시 Sentry.captureException 으로 에러를 전송한다", () => {
    const err = makeError();
    render(<PublicError error={err} reset={vi.fn()} />);
    expect(captureException).toHaveBeenCalledWith(err);
  });

  it("루트 error.tsx 와 같은 문구 체계로 안내 카드를 렌더한다", () => {
    render(<PublicError error={makeError()} reset={vi.fn()} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "문제가 발생했습니다" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/페이지를 불러오는 중 오류가 발생했습니다\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/잠시 후 다시 시도해 주세요\./)
    ).toBeInTheDocument();
  });

  it("다시 시도(reset) 버튼과 홈으로 링크를 제공한다", () => {
    const reset = vi.fn();
    render(<PublicError error={makeError()} reset={reset} />);

    const retry = screen.getByRole("button", { name: "다시 시도" });
    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);

    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("digest 가 있으면 오류 코드를 노출한다", () => {
    render(<PublicError error={makeError("pub-digest-42")} reset={vi.fn()} />);
    expect(screen.getByText("오류 코드: pub-digest-42")).toBeInTheDocument();
  });
});
