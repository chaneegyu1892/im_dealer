import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteResultActions } from "./QuoteResultActions";

type AnimationFrameCallback = (time: number) => void;

const props = {
  onContractApply: () => undefined,
  isApplying: false,
  applyError: null,
};

describe("QuoteResultActions", () => {
  let animationFrames: AnimationFrameCallback[];
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;

  beforeEach(() => {
    animationFrames = [];
    originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      animationFrames.push((time) => callback(time));
      return animationFrames.length;
    };
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    delete window.ChannelIO;
    vi.restoreAllMocks();
  });

  function flushAnimationFrames(): void {
    const pending = animationFrames.splice(0);
    pending.forEach((callback) => callback(0));
  }

  describe("Given a completed quote result", () => {
    it("When rendered Then it exposes the three exact actions", () => {
      render(<QuoteResultActions {...props} />);

      expect(screen.getByRole("button", { name: "견적서 전송하기" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "심사 요청하기" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "상담하기" })).toBeInTheDocument();
    });

    it("When send is selected Then it opens the preparation sheet without fetching", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      render(<QuoteResultActions {...props} />);
      const opener = screen.getByRole("button", { name: "견적서 전송하기" });

      opener.focus();
      fireEvent.click(opener);
      flushAnimationFrames();

      const dialog = await screen.findByRole("dialog", { name: "기능 구현 중입니다" });
      expect(screen.getByText("카카오톡 채널을 통한 견적서 전송 기능을 준비하고 있어요.")).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();

      const closeButton = screen.getByRole("button", { name: "닫기" });
      const confirmButton = screen.getByRole("button", { name: "확인" });
      expect(closeButton).toHaveFocus();

      confirmButton.focus();
      fireEvent.keyDown(window, { key: "Tab" });
      expect(closeButton).toHaveFocus();
      closeButton.focus();
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(confirmButton).toHaveFocus();
      expect(dialog).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => expect(opener).toHaveFocus());
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("When the visible confirmation is selected Then it only closes and restores focus", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      render(<QuoteResultActions {...props} />);
      const opener = screen.getByRole("button", { name: "견적서 전송하기" });

      opener.focus();
      fireEvent.click(opener);
      flushAnimationFrames();
      await screen.findByRole("dialog", { name: "기능 구현 중입니다" });

      fireEvent.click(screen.getByRole("button", { name: "확인" }));
      await waitFor(() => expect(opener).toHaveFocus());
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("Given apply state supplied by the quote page", () => {
    it("When the review action is selected Then it calls the supplied callback", () => {
      const onContractApply = vi.fn<() => void>();
      render(<QuoteResultActions {...props} onContractApply={onContractApply} />);

      fireEvent.click(screen.getByRole("button", { name: "심사 요청하기" }));

      expect(onContractApply).toHaveBeenCalledTimes(1);
    });

    it("When applying Then it preserves the loading label and busy state", () => {
      render(<QuoteResultActions {...props} isApplying />);

      const applyButton = screen.getByRole("button", { name: "견적 저장 중…" });
      expect(applyButton).toBeDisabled();
      expect(applyButton).toHaveAttribute("aria-busy", "true");
    });

    it("When apply fails Then it renders the supplied error as a visible alert", () => {
      render(<QuoteResultActions {...props} applyError="견적 저장에 실패했어요." />);

      expect(screen.getByRole("alert")).toHaveTextContent("견적 저장에 실패했어요.");
    });
  });

  describe("Given ChannelTalk is available", () => {
    it("When consultation is selected Then it shows the generic messenger", () => {
      const calls: unknown[][] = [];
      window.ChannelIO = (...args: unknown[]) => {
        calls.push(args);
      };
      render(<QuoteResultActions {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "상담하기" }));

      expect(calls).toEqual([["showMessenger"]]);
    });
  });
});
