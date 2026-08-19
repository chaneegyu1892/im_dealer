import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AdminQuoteAlimtalk, AdminQuoteDelivery } from "@/types/admin";
import {
  QuoteDeliveryDetail,
  QuoteDeliveryStatusBadge,
} from "./QuoteDeliveryStatusBadge";

function delivery(
  overrides: Partial<AdminQuoteDelivery> = {}
): AdminQuoteDelivery {
  return {
    status: "NONE",
    failReason: null,
    createdAt: null,
    sentAt: null,
    ...overrides,
  };
}

function alimtalk(
  overrides: Partial<AdminQuoteAlimtalk> = {}
): AdminQuoteAlimtalk {
  return {
    status: "FAILED",
    failReason: "3019 톡 유저 아님",
    resultCode: "3019",
    templateKey: "QUOTE_DELIVERED",
    createdAt: "2026-08-19T09:05:00.000Z",
    resultAt: "2026-08-19T09:06:00.000Z",
    ...overrides,
  };
}

describe("QuoteDeliveryStatusBadge", () => {
  it("renders SENT/PENDING/FAILED badges and never labels NONE as 미전달", () => {
    const { rerender } = render(<QuoteDeliveryStatusBadge status="SENT" />);
    expect(screen.getByText("전달됨")).toBeInTheDocument();

    rerender(<QuoteDeliveryStatusBadge status="PENDING" />);
    expect(screen.getByText("전달중")).toBeInTheDocument();

    rerender(<QuoteDeliveryStatusBadge status="FAILED" />);
    expect(screen.getByText("실패")).toBeInTheDocument();

    rerender(<QuoteDeliveryStatusBadge status="NONE" />);
    expect(screen.getByText("이력없음")).toBeInTheDocument();
    expect(screen.queryByText("미전달")).not.toBeInTheDocument();
  });
});

describe("QuoteDeliveryDetail", () => {
  it("shows delivery fail reason and latest alimtalk result on FAILED", () => {
    render(
      <QuoteDeliveryDetail
        delivery={delivery({
          status: "FAILED",
          failReason: "카카오톡 미가입",
          createdAt: "2026-08-19T09:20:00.000Z",
        })}
        alimtalk={alimtalk()}
      />
    );

    expect(screen.getByText("실패")).toBeInTheDocument();
    expect(screen.getByText("카카오톡 미가입")).toBeInTheDocument();
    expect(screen.getByText("3019 톡 유저 아님")).toBeInTheDocument();
    expect(screen.getByText("QUOTE_DELIVERED")).toBeInTheDocument();
  });

  it("does not treat a quote without delivery as 미전달", () => {
    render(<QuoteDeliveryDetail delivery={delivery()} alimtalk={null} />);

    expect(screen.getByText("이력없음")).toBeInTheDocument();
    expect(screen.queryByText("미전달")).not.toBeInTheDocument();
    expect(screen.getByText("전달 이력이 없습니다.")).toBeInTheDocument();
  });
});
