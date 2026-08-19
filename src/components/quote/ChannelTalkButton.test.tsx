import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CHANNEL_TALK_STATUS_ATTR } from "@/lib/channel-talk-status";
import { ChannelTalkButton } from "./ChannelTalkButton";

afterEach(() => {
  delete window.ChannelIO;
  document.documentElement.removeAttribute(CHANNEL_TALK_STATUS_ATTR);
});

describe("ChannelTalkButton", () => {
  it("opens ChannelTalk with the same action as the global consultation buttons", () => {
    const calls: unknown[][] = [];
    window.ChannelIO = (...args: unknown[]) => {
      calls.push(args);
    };

    render(<ChannelTalkButton vehicleName="신형 G90" label="상담하기" />);

    fireEvent.click(screen.getByRole("button", { name: /상담하기/ }));

    expect(calls).toEqual([["showMessenger"]]);
  });
});
