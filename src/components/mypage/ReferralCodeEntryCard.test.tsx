import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferralCodeEntryCard } from "./ReferralCodeEntryCard";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

describe("ReferralCodeEntryCard", () => {
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

  it("마감일 안내와 입력란을 보여준다", () => {
    render(<ReferralCodeEntryCard deadlineLabel="2026.08.25" />);
    expect(screen.getByText(/추천인 코드가 있나요/)).toBeInTheDocument();
    expect(screen.getByText(/2026\.08\.25/)).toBeInTheDocument();
    expect(screen.getByLabelText("추천인 코드")).toBeInTheDocument();
  });

  it("형식이 잘못된 코드는 요청 없이 에러를 보여준다", async () => {
    render(<ReferralCodeEntryCard deadlineLabel="2026.08.25" />);
    fireEvent.change(screen.getByLabelText("추천인 코드"), {
      target: { value: "AB123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));

    expect(await screen.findByText(/형식이 올바르지 않습니다/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("성공 시 완료 상태를 보여준다", async () => {
    render(<ReferralCodeEntryCard deadlineLabel="2026.08.25" />);
    fireEvent.change(screen.getByLabelText("추천인 코드"), {
      target: { value: "k4821" },
    });
    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));

    expect(await screen.findByText(/추천이 적용됐어요/)).toBeInTheDocument();
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(body.code).toBe("K4821");
  });

  it("서버 에러 메시지를 그대로 보여준다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "이미 추천이 적용된 계정입니다." }),
      }),
    );
    render(<ReferralCodeEntryCard deadlineLabel="2026.08.25" />);
    fireEvent.change(screen.getByLabelText("추천인 코드"), {
      target: { value: "K4821" },
    });
    fireEvent.click(screen.getByRole("button", { name: "적용하기" }));

    expect(
      await screen.findByText("이미 추천이 적용된 계정입니다."),
    ).toBeInTheDocument();
    await waitFor(() => expect(mocks.refresh).not.toHaveBeenCalled());
  });
});
