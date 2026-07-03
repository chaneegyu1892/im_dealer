import { describe, expect, it } from "vitest";
import {
  availableRepresentativeQuotes,
  hasRepresentativeQuote,
  lowestMonthly,
  type RepresentativeQuote,
} from "./representative-quote";

function quote(monthlyPayment: number, productType = "장기렌트"): RepresentativeQuote {
  return {
    productType,
    monthlyPayment,
    financeCompanyName: "테스트캐피탈",
  };
}

describe("representative quote availability", () => {
  it("treats empty, zero, negative, and non-finite payments as unavailable", () => {
    expect(hasRepresentativeQuote(undefined)).toBe(false);
    expect(hasRepresentativeQuote([])).toBe(false);
    expect(hasRepresentativeQuote([quote(0)])).toBe(false);
    expect(hasRepresentativeQuote([quote(-1)])).toBe(false);
    expect(hasRepresentativeQuote([quote(Number.NaN)])).toBe(false);
  });

  it("keeps only positive monthly payments for availability and lowest monthly", () => {
    const quotes = [
      quote(0),
      quote(820_000),
      quote(710_000, "리스"),
    ];

    expect(availableRepresentativeQuotes(quotes)).toEqual([
      quote(820_000),
      quote(710_000, "리스"),
    ]);
    expect(hasRepresentativeQuote(quotes)).toBe(true);
    expect(lowestMonthly(quotes)).toBe(710_000);
  });
});
