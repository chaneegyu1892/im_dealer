import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import ErrorPage from "./error";

describe("error.tsx 에러 바운더리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("마운트 시 Sentry.captureException 으로 에러를 전송한다", () => {
    const err = new Error("boom") as Error & { digest?: string };
    render(<ErrorPage error={err} reset={vi.fn()} />);
    expect(captureException).toHaveBeenCalledWith(err);
  });
});
