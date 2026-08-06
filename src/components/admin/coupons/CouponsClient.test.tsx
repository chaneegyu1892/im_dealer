import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CouponsClient } from "./CouponsClient";

const policy = {
  id: "policy-1",
  code: "SIGNUP_FUEL_100K",
  trigger: "SIGNUP",
  title: "첫가입 축하 주유권",
  description: null,
  rewardLabel: "주유권 10만원",
  rewardAmount: 100_000,
  rewardKind: "FUEL",
  termsNote: null,
  validDays: 90,
  isActive: true,
  displayOrder: 10,
};

function issued(overrides: Record<string, unknown> = {}) {
  return {
    id: "coupon-1",
    code: "AD-8F3K2A",
    status: "PENDING",
    titleSnapshot: "첫계약 축하금",
    rewardLabelSnapshot: "축하금 30만원",
    issuedAt: "2026-08-01T00:00:00.000Z",
    paidAt: null,
    paidMemo: null,
    user: { id: "user-1", name: "홍길동", phone: "010-1234-5678" },
    ...overrides,
  };
}

function mockFetch(handler: (url: string) => { ok: boolean; body: unknown }) {
  return vi.fn((input: RequestInfo | URL) => {
    const { ok, body } = handler(String(input));
    return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
  });
}

describe("CouponsClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url) =>
        url.includes("/policies")
          ? { ok: true, body: { data: [policy] } }
          : { ok: true, body: { data: [issued()] } }
      )
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("정책 탭을 기본으로 열고 목록을 보여준다", async () => {
    render(<CouponsClient />);

    expect(await screen.findByText("첫가입 축하 주유권")).toBeInTheDocument();
  });

  it("수정 모드에서는 코드와 트리거를 잠근다", async () => {
    render(<CouponsClient />);
    fireEvent.click(await screen.findByRole("button", { name: "수정" }));

    expect(screen.getByDisplayValue("SIGNUP_FUEL_100K")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /트리거/ })).toBeDisabled();
  });

  it("정책 추가 모드에서는 코드와 트리거를 입력할 수 있다", async () => {
    render(<CouponsClient />);
    fireEvent.click(await screen.findByRole("button", { name: "정책 추가" }));

    expect(screen.getByRole("combobox", { name: /트리거/ })).not.toBeDisabled();
  });

  it("지급 예정 쿠폰에만 지급 처리 버튼을 띄운다", async () => {
    render(<CouponsClient />);
    fireEvent.click(screen.getByRole("button", { name: "발급 현황" }));

    expect(await screen.findByRole("button", { name: "지급 완료 처리" })).toBeInTheDocument();
  });

  it("이미 지급된 쿠폰에는 지급 처리 버튼을 띄우지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch((url) =>
        url.includes("/policies")
          ? { ok: true, body: { data: [] } }
          : { ok: true, body: { data: [issued({ status: "PAID", paidAt: "2026-08-02T00:00:00.000Z" })] } }
      )
    );
    render(<CouponsClient />);
    fireEvent.click(screen.getByRole("button", { name: "발급 현황" }));

    expect(await screen.findByText("지급 완료")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "지급 완료 처리" })).not.toBeInTheDocument();
  });

  it("API 오류 문구를 배너로 보여준다", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({ ok: false, body: { error: "권한이 없습니다." } }))
    );
    render(<CouponsClient />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("권한이 없습니다."));
  });
});
