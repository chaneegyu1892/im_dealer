import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemberGate } from "./MemberGate";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("MemberGate", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("locked=false 면 children 을 노출하고 로그인 오버레이는 렌더하지 않는다", () => {
    render(
      <MemberGate locked={false}>
        <p>회원 전용 수치</p>
      </MemberGate>
    );

    expect(screen.getByText("회원 전용 수치")).toBeInTheDocument();
    expect(
      screen.queryByText("월 납입금을 낮추고 싶으시다면 로그인 해주세요")
    ).not.toBeInTheDocument();
  });

  it("locked=true 면 블러된 children 위에 로그인 유도 CTA 를 띄운다", () => {
    render(
      <MemberGate locked>
        <p>회원 전용 수치</p>
      </MemberGate>
    );

    // children 은 여전히 DOM 에 있으나(블러), 로그인 멘트와 카카오 CTA 가 추가로 노출된다.
    expect(screen.getByText("회원 전용 수치")).toBeInTheDocument();
    expect(
      screen.getByText("월 납입금을 낮추고 싶으시다면 로그인 해주세요")
    ).toBeInTheDocument();
    expect(screen.getByText("카카오로 로그인 →")).toBeInTheDocument();
  });

  it("커스텀 message 를 오버레이에 반영한다", () => {
    render(
      <MemberGate locked message="로그인하고 더 저렴하게">
        <span>x</span>
      </MemberGate>
    );
    expect(screen.getByText("로그인하고 더 저렴하게")).toBeInTheDocument();
  });

  it("오버레이 클릭 시 next 파라미터를 보존해 /login 으로 이동한다", () => {
    render(
      <MemberGate locked>
        <span>x</span>
      </MemberGate>
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "월 납입금을 낮추고 싶으시다면 로그인 해주세요",
      })
    );

    expect(pushMock).toHaveBeenCalledTimes(1);
    const target = pushMock.mock.calls[0][0] as string;
    expect(target).toMatch(/^\/login\?next=/);
  });

  it("onLogin 이 주어지면 기본 라우팅 대신 onLogin 을 호출한다", () => {
    const onLogin = vi.fn();
    render(
      <MemberGate locked onLogin={onLogin}>
        <span>x</span>
      </MemberGate>
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "월 납입금을 낮추고 싶으시다면 로그인 해주세요",
      })
    );

    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
