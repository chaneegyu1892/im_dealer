import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepresentativeQuotePrice } from "./RepresentativeQuotePrice";

const quotes = [
  {
    productType: "장기렌트",
    monthlyPayment: 650_000,
    financeCompanyName: "렌트캐피탈",
  },
  {
    productType: "리스",
    monthlyPayment: 610_000,
    financeCompanyName: "리스캐피탈",
  },
];

describe("RepresentativeQuotePrice 정렬", () => {
  it("align=end이면 여러 견적의 오른쪽 끝을 맞춘다", () => {
    render(<RepresentativeQuotePrice quotes={quotes} align="end" showCaption={false} />);

    const rentalRow = screen.getByText("장기렌트").parentElement;
    expect(rentalRow).toHaveClass("justify-end");
    expect(rentalRow?.parentElement).toHaveClass("items-end");
  });

  it("정렬 옵션을 생략하면 기존 왼쪽 정렬을 유지한다", () => {
    render(<RepresentativeQuotePrice quotes={quotes} showCaption={false} />);

    expect(screen.getByText("장기렌트").parentElement).not.toHaveClass("justify-end");
  });
});
