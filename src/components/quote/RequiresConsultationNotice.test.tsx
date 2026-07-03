import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RequiresConsultationNotice } from "./RequiresConsultationNotice";

afterEach(() => {
  delete window.ChannelIO;
});

describe("RequiresConsultationNotice", () => {
  it("shows the manual consultation guidance with a ChannelTalk action", () => {
    const calls: unknown[][] = [];
    window.ChannelIO = (...args: unknown[]) => {
      calls.push(args);
    };

    render(<RequiresConsultationNotice vehicleName="카니발" />);

    expect(screen.getByText("이 차량은 별도 상담이 필요합니다")).toBeInTheDocument();
    expect(
      screen.getByText("상담을 통한 견적이 더 정확합니다.", { exact: false })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "상담하기" }));

    expect(calls).toEqual([
      ["openChat", { message: "[카니발] 관련 상담을 원해요." }],
    ]);
  });
});
