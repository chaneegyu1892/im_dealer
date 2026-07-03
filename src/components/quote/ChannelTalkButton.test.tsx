import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChannelTalkButton } from "./ChannelTalkButton";

afterEach(() => {
  delete window.ChannelIO;
});

describe("ChannelTalkButton", () => {
  it("opens ChannelTalk with the selected vehicle message", () => {
    const calls: unknown[][] = [];
    window.ChannelIO = (...args: unknown[]) => {
      calls.push(args);
    };

    render(<ChannelTalkButton vehicleName="신형 G90" label="상담하기" />);

    fireEvent.click(screen.getByRole("button", { name: /상담하기/ }));

    expect(calls).toEqual([
      ["openChat", { message: "[신형 G90] 관련 상담을 원해요." }],
    ]);
  });
});
