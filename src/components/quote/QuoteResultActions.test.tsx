import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuoteResultActions } from "./QuoteResultActions";

const props = {
  onContractApply: () => undefined,
  isApplying: false,
  applyError: null,
  kakaoDeliveryEnabled: true,
  channelTalkDelivery: false,
  isDelivering: false,
  deliverySuccess: false,
  deliveryError: null,
  onQuoteDeliver: () => undefined,
};

describe("QuoteResultActions", () => {
  afterEach(() => {
    delete window.ChannelIO;
    vi.restoreAllMocks();
  });

  describe("Given a completed quote result", () => {
    it("When rendered Then it exposes the three exact actions", () => {
      render(<QuoteResultActions {...props} />);

      expect(
        screen.getByRole("button", { name: "카카오톡으로 견적서 받기" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "심사 요청하기" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "상담하기" })).toBeInTheDocument();
    });

    it("When Kakao delivery is selected Then it calls the supplied callback", () => {
      const onQuoteDeliver = vi.fn<() => void>();
      render(
        <QuoteResultActions
          {...props}
          onQuoteDeliver={onQuoteDeliver}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "카카오톡으로 견적서 받기" })
      );

      expect(onQuoteDeliver).toHaveBeenCalledTimes(1);
    });

    it("When both delivery modes are disabled Then it hides only the delivery action", () => {
      render(
        <QuoteResultActions
          {...props}
          kakaoDeliveryEnabled={false}
          channelTalkDelivery={false}
        />
      );

      expect(
        screen.queryByRole("button", { name: "카카오톡으로 견적서 받기" })
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "심사 요청하기" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "상담하기" })).toBeInTheDocument();
    });

    it("When Kakao delivery is pending Then it exposes the busy state", () => {
      render(<QuoteResultActions {...props} isDelivering />);

      const deliveryButton = screen.getByRole("button", { name: "전송 중…" });
      expect(deliveryButton).toBeDisabled();
      expect(deliveryButton).toHaveAttribute("aria-busy", "true");
    });

    it("When Kakao delivery succeeds Then it renders the completion status", () => {
      render(<QuoteResultActions {...props} deliverySuccess />);

      expect(screen.getByRole("status")).toHaveTextContent(
        "카카오톡으로 견적서를 보냈어요."
      );
    });

    it("When Kakao delivery fails Then it renders the supplied error", () => {
      render(
        <QuoteResultActions
          {...props}
          deliveryError="카카오톡 전송에 실패했습니다."
        />
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "카카오톡 전송에 실패했습니다."
      );
    });
  });

  describe("Given the ChannelTalk delivery stopgap (Kakao auto-send off)", () => {
    const stopgapProps = {
      ...props,
      kakaoDeliveryEnabled: false,
      channelTalkDelivery: true,
    };

    it("When rendered Then it still exposes the quote delivery action", () => {
      render(<QuoteResultActions {...stopgapProps} />);

      expect(
        screen.getByRole("button", { name: "카카오톡으로 견적서 받기" })
      ).toBeInTheDocument();
    });

    it("When the delivery action is selected Then it calls the supplied callback", () => {
      const onQuoteDeliver = vi.fn<() => void>();
      render(
        <QuoteResultActions {...stopgapProps} onQuoteDeliver={onQuoteDeliver} />
      );

      fireEvent.click(
        screen.getByRole("button", { name: "카카오톡으로 견적서 받기" })
      );

      expect(onQuoteDeliver).toHaveBeenCalledTimes(1);
    });

    it("When pending Then it shows the ChannelTalk busy label", () => {
      render(<QuoteResultActions {...stopgapProps} isDelivering />);

      const deliveryButton = screen.getByRole("button", { name: "상담창 여는 중…" });
      expect(deliveryButton).toBeDisabled();
      expect(deliveryButton).toHaveAttribute("aria-busy", "true");
    });

    it("When it succeeds Then it guides the customer to send the chat message", () => {
      render(<QuoteResultActions {...stopgapProps} deliverySuccess />);

      expect(screen.getByRole("status")).toHaveTextContent(
        "전송하시면 담당자가 견적서를 보내드려요."
      );
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
