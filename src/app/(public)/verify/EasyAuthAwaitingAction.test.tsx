import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EASY_AUTH_CONFIRM_DELAY_MS,
  EasyAuthAwaitingAction,
} from "./EasyAuthAwaitingAction";

describe("EasyAuthAwaitingAction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("인증 대기 직후 완료 버튼을 잠시 막고 안내 문구를 보여준다", () => {
    render(
      <EasyAuthAwaitingAction
        docLabel="사업자등록증명"
        busy={false}
        onConfirm={vi.fn()}
      />
    );

    expect(
      screen.getByText("알림을 확인하고 인증을 진행하고 나서 인증 완료 버튼을 눌러주세요.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "인증을 완료했어요" })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(EASY_AUTH_CONFIRM_DELAY_MS);
    });

    expect(screen.getByRole("button", { name: "인증을 완료했어요" })).toBeEnabled();
  });
});
