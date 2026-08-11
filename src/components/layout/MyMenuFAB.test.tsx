import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/cars",
  refresh: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: mocks.unsubscribe } },
      }),
    },
  }),
}));

interface MotionMockProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const strip = (props: Record<string, unknown>) => {
    const {
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      whileTap: _w,
      layout: _l,
      ...rest
    } = props;
    return rest;
  };

  return {
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: MotionMockProps) =>
        React.createElement("div", strip(props), children),
      button: React.forwardRef<HTMLButtonElement, MotionMockProps>(function MotionButton(
        props,
        ref,
      ) {
        const { children, ...rest } = props;
        return React.createElement(
          "button",
          { ...strip(rest), ref },
          children as React.ReactNode,
        );
      }),
    },
    useReducedMotion: () => true,
  };
});

import { MyMenuFAB } from "./MyMenuFAB";

const LOGGED_IN_USER = {
  id: "user-1",
  email: "member@example.com",
  user_metadata: { name: "테스트 고객" },
};

function setLoggedIn() {
  mocks.getUser.mockResolvedValue({ data: { user: LOGGED_IN_USER } });
}

function setLoggedOut() {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
}

describe("MyMenuFAB", () => {
  beforeEach(() => {
    mocks.pathname = "/cars";
    mocks.refresh.mockReset();
    mocks.getUser.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.unsubscribe.mockReset();
  });

  it("로그인 상태에서 My 버튼을 보여준다", async () => {
    setLoggedIn();
    render(<MyMenuFAB />);

    const trigger = await screen.findByRole("button", { name: "My 메뉴" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("My 버튼을 누르면 5개 메뉴가 열리고 각 링크가 올바른 경로를 가리킨다", async () => {
    setLoggedIn();
    render(<MyMenuFAB />);

    const trigger = await screen.findByRole("button", { name: "My 메뉴" });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "My 메뉴 목록" })).toBeInTheDocument();

    expect(screen.getByRole("menuitem", { name: "내 견적보기" })).toHaveAttribute(
      "href",
      "/mypage",
    );
    expect(screen.getByRole("menuitem", { name: "추천인 페이지" })).toHaveAttribute(
      "href",
      "/mypage/referral",
    );
    expect(screen.getByRole("menuitem", { name: "쿠폰함" })).toHaveAttribute(
      "href",
      "/mypage/coupons",
    );
    expect(screen.getByRole("menuitem", { name: "내 정보" })).toHaveAttribute("href", "/mypage");
    expect(screen.getByRole("menuitem", { name: "로그아웃" })).toBeInTheDocument();

    expect(screen.getAllByRole("menuitem")).toHaveLength(5);
  });

  it("바깥을 클릭하면 메뉴가 닫힌다", async () => {
    setLoggedIn();
    render(<MyMenuFAB />);

    const trigger = await screen.findByRole("button", { name: "My 메뉴" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("ESC 를 누르면 메뉴가 닫히고 포커스가 트리거로 돌아온다", async () => {
    setLoggedIn();
    render(<MyMenuFAB />);

    const trigger = await screen.findByRole("button", { name: "My 메뉴" });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("메뉴 항목을 클릭하면 메뉴가 닫힌다", async () => {
    setLoggedIn();
    render(<MyMenuFAB />);

    fireEvent.click(await screen.findByRole("button", { name: "My 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "쿠폰함" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("로그아웃을 누르면 signOut 후 라우터를 갱신하고 로그인 CTA 로 바뀐다", async () => {
    setLoggedIn();
    render(<MyMenuFAB />);

    fireEvent.click(await screen.findByRole("button", { name: "My 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "로그아웃" }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));

    const loginCta = await screen.findByRole("link", { name: "로그인" });
    expect(loginCta).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "My 메뉴" })).not.toBeInTheDocument();
  });

  it("비로그인 상태에서는 로그인 CTA 만 보여준다", async () => {
    setLoggedOut();
    render(<MyMenuFAB />);

    const loginCta = await screen.findByRole("link", { name: "로그인" });
    expect(loginCta).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "My 메뉴" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("모바일에서는 BottomNav 스택 오프셋 위에 배치된다", async () => {
    setLoggedIn();
    render(<MyMenuFAB />);

    const trigger = await screen.findByRole("button", { name: "My 메뉴" });
    const wrapper = trigger.parentElement;

    expect(wrapper?.className).toContain(
      "bottom-[calc(var(--bottom-nav-stack-offset,88px)+env(safe-area-inset-bottom,0px)+68px)]",
    );
    expect(wrapper?.className).toContain("lg:bottom-6");
    expect(wrapper?.className).toContain("right-4");
  });

  it("홈에서는 렌더하지 않는다", async () => {
    setLoggedIn();
    mocks.pathname = "/";
    const { container } = render(<MyMenuFAB />);

    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("비로그인 상태의 홈에서도 렌더하지 않는다", async () => {
    setLoggedOut();
    mocks.pathname = "/";
    const { container } = render(<MyMenuFAB />);

    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("견적·로그인 등 단일 작업 화면에서는 렌더하지 않는다", async () => {
    setLoggedIn();
    mocks.pathname = "/quote?vehicle=test";
    const { container } = render(<MyMenuFAB />);

    await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
