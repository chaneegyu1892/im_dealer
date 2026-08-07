import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CouponBoxItem } from "@/lib/member-queries/coupons";
import { CouponTicket } from "./CouponTicket";

function makeCoupon(overrides: Partial<CouponBoxItem> = {}): CouponBoxItem {
  return {
    id: "coupon-1",
    code: "AD-8F3K2A",
    status: "HELD",
    title: "첫가입 축하 주유권",
    description: "계약을 완료하면 지급돼요",
    rewardLabel: "주유권 10만원",
    rewardAmount: 100_000,
    rewardKind: "FUEL",
    termsNote: null,
    expiresAt: null,
    paidAt: null,
    ...overrides,
  };
}

describe("CouponTicket", () => {
  it("제목·리워드·상태 라벨을 보여준다", () => {
    render(<CouponTicket coupon={makeCoupon()} />);

    expect(screen.getByText("첫가입 축하 주유권")).toBeInTheDocument();
    expect(screen.getByText("주유권 10만원")).toBeInTheDocument();
    expect(screen.getByText("보유")).toBeInTheDocument();
  });

  it("스텁에는 금액을 만원 단위로 줄여 보여준다", () => {
    render(<CouponTicket coupon={makeCoupon()} />);

    expect(screen.getByText("10만원")).toBeInTheDocument();
  });

  it("금액이 없는 리워드는 스텁에 혜택으로 표시한다", () => {
    render(<CouponTicket coupon={makeCoupon({ rewardAmount: null, rewardKind: "GIFT" })} />);

    expect(screen.getByText("혜택")).toBeInTheDocument();
  });

  it("지급 예정 쿠폰은 지급 준비 중으로 표시한다", () => {
    render(<CouponTicket coupon={makeCoupon({ status: "PENDING" })} />);

    expect(screen.getByText("지급 준비 중")).toBeInTheDocument();
  });

  it("지급 완료 쿠폰은 지급일을 함께 보여준다", () => {
    render(
      <CouponTicket
        coupon={makeCoupon({ status: "PAID", paidAt: new Date("2026-05-21T00:00:00.000Z") })}
      />
    );

    expect(screen.getByText(/5월 21일/)).toBeInTheDocument();
  });

  it("만료일이 있으면 남은 일수를 보여준다", () => {
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    render(<CouponTicket coupon={makeCoupon({ expiresAt })} />);

    expect(screen.getByText("D-5")).toBeInTheDocument();
  });

  it("만료·취소 쿠폰에는 쿠폰 코드를 노출하지 않는다", () => {
    render(<CouponTicket coupon={makeCoupon({ status: "EXPIRED" })} />);

    expect(screen.queryByText("AD-8F3K2A")).not.toBeInTheDocument();
  });
});
