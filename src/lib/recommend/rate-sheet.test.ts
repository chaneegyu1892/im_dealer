import { describe, expect, it } from "vitest";
import { parseRateSheetRaw } from "./rate-sheet";

const VALID_RATE_SHEET = {
  "36_10000": 0.01,
  "36_20000": 0.011,
  "36_30000": 0.012,
  "48_10000": 0.013,
  "48_20000": 0.014,
  "48_30000": 0.015,
  "60_10000": 0.016,
  "60_20000": 0.017,
  "60_30000": 0.018,
};

describe("parseRateSheetRaw", () => {
  it("9개 회수율 키가 모두 숫자면 RateSheetRaw로 반환한다", () => {
    expect(parseRateSheetRaw(VALID_RATE_SHEET)).toEqual(VALID_RATE_SHEET);
  });

  it("필수 회수율 키가 없으면 null을 반환한다", () => {
    const invalidSheet = Object.fromEntries(
      Object.entries(VALID_RATE_SHEET).filter(([key]) => key !== "60_30000")
    );

    expect(parseRateSheetRaw(invalidSheet)).toBeNull();
  });
});
