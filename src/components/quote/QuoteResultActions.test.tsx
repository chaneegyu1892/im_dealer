import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuoteResultActions } from "./QuoteResultActions";

const props = {
  kakaoDeliveryEnabled: true,
  channelTalkDelivery: false,
  isDelivering: false,
  deliverySuccess: false,
  deliveryError: null,
  onQuoteDeliver: () => undefined,
  onReopenChannelChat: () => undefined,
  onConfirmChannelSent: () => undefined,
  deliveryConfirmedBySender: false,
};

describe("QuoteResultActions", () => {
  afterEach(() => {
    delete window.ChannelIO;
    vi.restoreAllMocks();
  });

  describe("Given a completed quote result", () => {
    it("When rendered Then it exposes delivery and review-request actions", () => {
      render(<QuoteResultActions {...props} />);

      expect(
        screen.getByRole("button", { name: "카카오톡으로 견적서 받기" })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "심사 요청하기" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "상담하기" })).toBeInTheDocument();
      expect(screen.queryByText("서류 심사 서비스는 준비 중이에요")).not.toBeInTheDocument();
    });

    it("When review request is selected Then it opens the coming-soon modal with contact CTAs", () => {
      render(<QuoteResultActions {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "심사 요청하기" }));

      expect(
        screen.getByRole("dialog", { name: "서류 심사 서비스는 준비 중이에요" })
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /1688-8479 전화 걸기/ })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "상담하기" }).length).toBeGreaterThanOrEqual(1);
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

      const deliveryButton = screen.getByRole("button", { name: "요청 준비 중…" });
      expect(deliveryButton).toBeDisabled();
      expect(deliveryButton).toHaveAttribute("aria-busy", "true");
    });

    it("When the chat opens Then it states the request is not sent yet", () => {
      render(<QuoteResultActions {...stopgapProps} deliverySuccess />);

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("아직 보내지 않았어요");
      expect(status).not.toHaveTextContent("요청 메시지를 복사했어요");
    });

    it("When the customer confirms they sent it Then it calls the supplied callback", () => {
      const onConfirmChannelSent = vi.fn<() => void>();
      render(
        <QuoteResultActions
          {...stopgapProps}
          deliverySuccess
          onConfirmChannelSent={onConfirmChannelSent}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "보냈어요" }));

      expect(onConfirmChannelSent).toHaveBeenCalledTimes(1);
    });

    it("When the customer confirmed sending Then it drops the warning and thanks them", () => {
      render(
        <QuoteResultActions {...stopgapProps} deliverySuccess deliveryConfirmedBySender />
      );

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("상담사가 확인 후");
      expect(status).not.toHaveTextContent("아직 보내지 않았어요");
      expect(screen.queryByRole("button", { name: "보냈어요" })).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "대화창 다시 열기" })
      ).toBeInTheDocument();
    });

    it("When the chat window was closed Then it offers to reopen it", () => {
      const onReopenChannelChat = vi.fn<() => void>();
      render(
        <QuoteResultActions
          {...stopgapProps}
          deliverySuccess
          onReopenChannelChat={onReopenChannelChat}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "대화창 다시 열기" }));

      expect(onReopenChannelChat).toHaveBeenCalledTimes(1);
    });

    it("When the chat has not been opened yet Then it hides the reopen action", () => {
      render(<QuoteResultActions {...stopgapProps} />);

      expect(
        screen.queryByRole("button", { name: "대화창 다시 열기" })
      ).not.toBeInTheDocument();
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
